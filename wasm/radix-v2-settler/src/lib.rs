use radix_common::network::NetworkDefinition;
use radix_common::prelude::{
    AddressBech32Encoder, ComponentAddress, Ed25519PrivateKey, Epoch,
};
use radix_transactions::manifest::{compile_manifest, BlobProvider};
use radix_transactions::prelude::*;
use serde::{Deserialize, Serialize};
use std::alloc::{alloc as std_alloc, dealloc as std_dealloc, Layout};
use std::slice;

#[derive(Deserialize)]
struct SettleRequest {
    /// 1 = mainnet, 2 = stokenet, 242 = simulator
    network_id: u8,
    current_epoch: u64,
    maker_signed_partial_tx_hex: String,
    taker_signed_partial_tx_hex: String,
    root_manifest: String,
    /// 32 random bytes (hex) used for ephemeral Ed25519 notary key + intent discriminator
    random_seed_hex: String,
}

#[derive(Serialize)]
struct SettleResponse {
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    notarized_transaction_hex: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    intent_hash: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

fn network_def(id: u8) -> NetworkDefinition {
    match id {
        1 => NetworkDefinition::mainnet(),
        2 => NetworkDefinition::stokenet(),
        _ => NetworkDefinition::simulator(),
    }
}

fn settle_inner(req: SettleRequest) -> Result<(String, String), String> {
    let network = network_def(req.network_id);

    let maker_bytes = hex::decode(req.maker_signed_partial_tx_hex.trim())
        .map_err(|e| format!("Invalid maker partial tx hex: {e}"))?;
    let taker_bytes = hex::decode(req.taker_signed_partial_tx_hex.trim())
        .map_err(|e| format!("Invalid taker partial tx hex: {e}"))?;

    let maker_partial = SignedPartialTransactionV2::from_raw(
        &RawSignedPartialTransaction::from_slice(&maker_bytes),
    )
    .map_err(|e| format!("Decode maker partial tx: {e:?}"))?;
    let taker_partial = SignedPartialTransactionV2::from_raw(
        &RawSignedPartialTransaction::from_slice(&taker_bytes),
    )
    .map_err(|e| format!("Decode taker partial tx: {e:?}"))?;

    let seed_bytes = hex::decode(req.random_seed_hex.trim())
        .map_err(|e| format!("Invalid random seed hex: {e}"))?;
    if seed_bytes.len() < 32 {
        return Err("random_seed_hex must be at least 32 bytes".into());
    }
    let mut key_bytes = [0u8; 32];
    key_bytes.copy_from_slice(&seed_bytes[..32]);
    let notary_key = Ed25519PrivateKey::from_bytes(&key_bytes)
        .map_err(|e| format!("Invalid ephemeral notary key: {e:?}"))?;

    let mut disc_bytes = [0u8; 8];
    disc_bytes.copy_from_slice(&seed_bytes[..8]);
    let discriminator = u64::from_le_bytes(disc_bytes);

    let notary_pub = notary_key.public_key();
    let notary_account = ComponentAddress::preallocated_account_from_public_key(&notary_pub);
    let addr_encoder = AddressBech32Encoder::new(&network);
    let notary_account_str = addr_encoder
        .encode(notary_account.as_node_id().as_bytes())
        .map_err(|e| format!("Encode notary virtual account: {e:?}"))?;

    let resolved_manifest = req
        .root_manifest
        .replace("{{NOTARY_ACCOUNT}}", &notary_account_str);

    let manifest: TransactionManifestV2 =
        compile_manifest(&resolved_manifest, &network, BlobProvider::new())
            .map_err(|e| format!("Compile root manifest: {e:?}"))?;

    let notarized = TransactionV2Builder::new()
        .intent_header(IntentHeaderV2 {
            network_id: network.id,
            start_epoch_inclusive: Epoch::of(req.current_epoch),
            end_epoch_exclusive: Epoch::of(req.current_epoch.saturating_add(10)),
            min_proposer_timestamp_inclusive: None,
            max_proposer_timestamp_exclusive: None,
            intent_discriminator: discriminator,
        })
        .transaction_header(TransactionHeaderV2 {
            notary_public_key: notary_pub.into(),
            notary_is_signatory: true,
            tip_basis_points: 0,
        })
        .add_signed_child("maker", maker_partial)
        .add_signed_child("taker", taker_partial)
        .manifest(manifest)
        .notarize(&notary_key)
        .build();

    let prepared = notarized
        .raw
        .prepare(&PreparationSettings::latest())
        .map_err(|e| format!("Prepare notarized V2 tx: {e:?}"))?;

    let encoder = TransactionHashBech32Encoder::new(&network);
    let intent_hash = encoder
        .encode(&prepared.transaction_intent_hash())
        .map_err(|e| format!("Encode intent hash: {e:?}"))?;

    Ok((hex::encode(notarized.raw.as_slice()), intent_hash))
}

#[no_mangle]
pub extern "C" fn wasm_alloc(len: usize) -> *mut u8 {
    if len == 0 {
        return std::ptr::null_mut();
    }
    let layout = Layout::from_size_align(len, 1).unwrap();
    unsafe { std_alloc(layout) }
}

#[no_mangle]
pub extern "C" fn wasm_dealloc(ptr: *mut u8, len: usize) {
    if ptr.is_null() || len == 0 {
        return;
    }
    let layout = Layout::from_size_align(len, 1).unwrap();
    unsafe { std_dealloc(ptr, layout) }
}

/// Receives a UTF-8 JSON `SettleRequest` at `(ptr, len)` and returns a packed
/// `u64` where the upper 32 bits are the output pointer and the lower 32 bits
/// are the output byte length (UTF-8 JSON `SettleResponse`).
#[no_mangle]
pub extern "C" fn settle_v2_swap(ptr: *const u8, len: usize) -> u64 {
    let input = unsafe { slice::from_raw_parts(ptr, len) };
    let resp = match serde_json::from_slice::<SettleRequest>(input) {
        Ok(req) => match settle_inner(req) {
            Ok((tx_hex, intent_hash)) => SettleResponse {
                ok: true,
                notarized_transaction_hex: Some(tx_hex),
                intent_hash: Some(intent_hash),
                error: None,
            },
            Err(err) => SettleResponse {
                ok: false,
                notarized_transaction_hex: None,
                intent_hash: None,
                error: Some(err),
            },
        },
        Err(err) => SettleResponse {
            ok: false,
            notarized_transaction_hex: None,
            intent_hash: None,
            error: Some(format!("Invalid JSON input: {err}")),
        },
    };

    let json = serde_json::to_vec(&resp).unwrap_or_else(|_| b"{\"ok\":false,\"error\":\"serialize\"}".to_vec());
    let out_len = json.len();
    let out_ptr = wasm_alloc(out_len);
    if !out_ptr.is_null() {
        unsafe {
            std::ptr::copy_nonoverlapping(json.as_ptr(), out_ptr, out_len);
        }
    }
    ((out_ptr as u64) << 32) | (out_len as u64)
}
