'use client';

import { useState } from 'react';
import { Terminal, BookOpen, ExternalLink } from 'lucide-react';
import type { Dictionary } from '@/types/i18n';


export function Tab3Client({ tab }: { tab: Dictionary['devs']['tab3'] }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const dict = tab;

  if (!dict?.tools) return null;

  // Colección de herramientas con datos completos
  const tools = [
    {
      name: dict.tools.rust.name,
      desc: dict.tools.rust.desc,
      tag: dict.tags.rust,
      url: 'https://rust-lang.org/es/tools/install/',
      code: (
        <>
          <span className="text-[var(--code-comment)]">{dict.comments.rustUniversal}</span><br />
          &nbsp;&nbsp;<span className="text-[var(--code-keyword)] font-bold">$</span> <span className="text-[var(--code-type)]">curl</span> --proto <span className="text-[var(--code-string)]">{"'=https'"}</span> --tlsv1.2 -sSf https://sh.rustup.rs | <span className="text-[var(--code-type)]">sh</span><br />
          &nbsp;&nbsp;<span className="text-[var(--code-keyword)] font-bold">$</span> <span className="text-[var(--code-keyword)]">source</span> <span className="text-[var(--code-string)]">{"\"$HOME/.cargo/env\""}</span><br /><br />

          <span className="text-[var(--code-comment)]">{dict.comments.rustArch}</span><br />
          &nbsp;&nbsp;<span className="text-[var(--code-keyword)] font-bold">$</span> <span className="text-[var(--code-keyword)]">sudo</span> <span className="text-[var(--code-type)]">pacman</span> -Syu rustup<br />
          &nbsp;&nbsp;<span className="text-[var(--code-keyword)] font-bold">$</span> <span className="text-[var(--code-type)]">rustup</span> default stable<br /><br />

          <span className="text-[var(--code-comment)]">{dict.comments.rustUbuntu}</span><br />
          &nbsp;&nbsp;<span className="text-[var(--code-keyword)] font-bold">$</span> <span className="text-[var(--code-keyword)]">sudo</span> <span className="text-[var(--code-type)]">apt</span> update<br />
          &nbsp;&nbsp;<span className="text-[var(--code-keyword)] font-bold">$</span> <span className="text-[var(--code-keyword)]">sudo</span> <span className="text-[var(--code-type)]">apt</span> install rustc cargo<br /><br />

          <span className="text-[var(--code-comment)]">{dict.comments.rustFedora}</span><br />
          &nbsp;&nbsp;<span className="text-[var(--code-keyword)] font-bold">$</span> <span className="text-[var(--code-keyword)]">sudo</span> <span className="text-[var(--code-keyword)]">dnf</span> update<br />
          &nbsp;&nbsp;<span className="text-[var(--code-keyword)] font-bold">$</span> <span className="text-[var(--code-keyword)]">sudo</span> <span className="text-[var(--code-type)]">dnf</span> install rust cargo<br /><br />

          <span className="text-[var(--code-comment)]">{dict.comments.rustSuse}</span><br />
          &nbsp;&nbsp;<span className="text-[var(--code-keyword)] font-bold">$</span> <span className="text-[var(--code-keyword)]">sudo</span> <span className="text-[var(--code-type)]">zypper</span> refresh<br />
          &nbsp;&nbsp;<span className="text-[var(--code-keyword)] font-bold">$</span> <span className="text-[var(--code-keyword)]">sudo</span> <span className="text-[var(--code-type)]">zypper</span> install rust cargo<br /><br />

          <span className="text-[var(--code-comment)]">{dict.comments.rustAlpine}</span><br />
          &nbsp;&nbsp;<span className="text-[var(--code-keyword)] font-bold">$</span> <span className="text-[var(--code-keyword)]">sudo</span> <span className="text-[var(--code-type)]">apk</span> add rust cargo<br /><br />

          <span className="text-[var(--code-comment)]">{dict.comments.rustVerify}</span><br />
          <span className="text-[var(--code-comment)]">{dict.comments.rustVerifyRustcNote}</span><br />
          &nbsp;&nbsp;<span className="text-[var(--code-keyword)] font-bold">$</span> <span className="text-[var(--code-type)]">rustc</span> --version<br />
          <span className="text-[var(--code-comment)]">{dict.comments.rustVerifyCargoNote}</span><br />
          &nbsp;&nbsp;<span className="text-[var(--code-keyword)] font-bold">$</span> <span className="text-[var(--code-type)]">cargo</span> --version
        </>
      )
    },
    {
      name: dict.tools.vscode.name,
      desc: dict.tools.vscode.desc,
      tag: dict.tags.ide,
      url: 'https://code.visualstudio.com/',
      code: (
        <>
          <span className="text-[var(--code-comment)]">{dict.comments.vscode}</span><br />
          <span className="text-[var(--code-comment)]">{dict.comments.vscodeInstall}</span><br />
          &nbsp;&nbsp;<span className="text-[var(--code-keyword)] font-bold">$</span> <span className="text-[var(--code-type)]">{dict.comments.vscodeExt1}</span><br />
          &nbsp;&nbsp;<span className="text-[var(--code-keyword)] font-bold">$</span> <span className="text-[var(--code-type)]">{dict.comments.vscodeExt2}</span>
        </>
      )
    },
    {
      name: dict.tools.scrypto.name,
      desc: dict.tools.scrypto.desc,
      tag: dict.tags.rust,
      url: 'https://github.com/radixdlt/radixdlt-scrypto?tab=readme-ov-file',
      code: (
        <>
          <span className="text-[var(--code-comment)]">{dict.comments.scryptoDebian}</span><br />
          &nbsp;&nbsp;<span className="text-[var(--code-keyword)] font-bold">$</span> <span className="text-[var(--code-type)]">curl</span> -fsSL <span className="text-[var(--code-string)]">https://raw.githubusercontent.com/radixdlt/radixdlt-scrypto/refs/heads/main/scrypto-install-scripts/install-scrypto-debian.sh</span> | <span className="text-[var(--code-type)]">bash</span><br /><br />

          <span className="text-[var(--code-comment)]">{dict.comments.scryptoStep1}</span><br />
          <span className="text-[var(--code-comment)] text-xs">{dict.comments.scryptoStep1Desc}</span><br />
          <span className="text-[var(--code-comment)]">{dict.comments.scryptoUbuntu}</span><br />
          &nbsp;&nbsp;<span className="text-[var(--code-keyword)] font-bold">$</span> <span className="text-[var(--code-keyword)]">sudo</span> <span className="text-[var(--code-type)]">apt</span> update<br />
          &nbsp;&nbsp;<span className="text-[var(--code-keyword)] font-bold">$</span> <span className="text-[var(--code-keyword)]">sudo</span> <span className="text-[var(--code-type)]">apt</span> install clang build-essential llvm
          <br />
          <span className="text-[var(--code-comment)]">{dict.comments.scryptoArch}</span><br />
          &nbsp;&nbsp;<span className="text-[var(--code-keyword)] font-bold">$</span> <span className="text-[var(--code-keyword)]">sudo</span> <span className="text-[var(--code-type)]">pacman</span> -Syu clang base-devel llvm<br />
          <span className="text-[var(--code-comment)]">{dict.comments.scryptoFedora}</span><br />
          &nbsp;&nbsp;<span className="text-[var(--code-keyword)] font-bold">$</span> <span className="text-[var(--code-keyword)]">sudo</span> <span className="text-[var(--code-keyword)]">dnf</span> install clang base-devel llvm<br /><br />

          <span className="text-[var(--code-comment)]">{dict.comments.scryptoStep2}</span><br />
          &nbsp;&nbsp;<span className="text-[var(--code-keyword)] font-bold">$</span> <span className="text-[var(--code-type)]">{dict.comments.scryptoStep2Cmd}</span><br /><br />
          <span className="text-[var(--code-comment)]">{dict.comments.scryptoStep3}</span><br />
          &nbsp;&nbsp;<span className="text-[var(--code-keyword)] font-bold">$</span> <span className="text-[var(--code-keyword)]">export</span> CC=clang<br />
          &nbsp;&nbsp;<span className="text-[var(--code-keyword)] font-bold">$</span> <span className="text-[var(--code-type)]">cargo</span> install {dict.comments.scryptoStep3Cmd1}<br /><br />

          <span className="text-[var(--code-comment)]">{dict.comments.scryptoStep4Title}</span><br />
          &nbsp;&nbsp;<span className="text-[var(--code-keyword)] font-bold">$</span> <span className="text-[var(--code-type)]">{dict.comments.scryptoStep4Cmd1}</span><br />
          &nbsp;&nbsp;<span className="text-[var(--code-keyword)] font-bold">$</span> <span className="text-[var(--code-type)]">{dict.comments.scryptoStep4Cmd2}</span><br />
          &nbsp;&nbsp;<span className="text-[var(--code-keyword)] font-bold">$</span> <span className="text-[var(--code-type)]">{dict.comments.scryptoStep4Cmd3}</span><br />
          &nbsp;&nbsp;<span className="text-[var(--code-keyword)] font-bold">$</span> <span className="text-[var(--code-type)]">{dict.comments.scryptoStep4Cmd4}</span><br /><br />

          <span className="text-[var(--code-comment)]">{dict.comments.scryptoFirstCmdTitle}</span><br />
          &nbsp;&nbsp;<span className="text-[var(--code-keyword)] font-bold">$</span> <span className="text-[var(--code-type)]">{dict.comments.scryptoFirstCmd}</span>
        </>
      )
    },
    {
      name: dict.tools.ret.name,
      desc: dict.tools.ret.desc,
      tag: dict.tags.stable,
      url: 'https://github.com/radixdlt/radix-engine-toolkit',
      code: (
        <>
          <span className="text-[var(--code-comment)]">{dict.comments.retTsNode}</span><br />
          &nbsp;&nbsp;<span className="text-[var(--code-type)]">npm</span> install <span className="text-[var(--code-string)]">@radixdlt/radix-engine-toolkit</span><br />
          &nbsp;&nbsp;<span className="text-[var(--code-type)]">yarn</span> add <span className="text-[var(--code-string)]">@radixdlt/radix-engine-toolkit</span><br /><br />

          <span className="text-[var(--code-comment)]">{dict.comments.retRust}</span><br />
          &nbsp;&nbsp;<span className="text-[var(--code-type)]">cargo</span> add radix-engine-toolkit --git <span className="text-[var(--code-string)]">https://github.com/radixdlt/radix-engine-toolkit.git</span><br /><br />
          <span className="text-[var(--code-comment)]">{dict.comments.retPython}</span><br />
          &nbsp;&nbsp;<span className="text-[var(--code-type)]">pip3</span> install <span className="text-[var(--code-string)]">radix-engine-toolkit</span><br />

        </>
      )
    },
    {
      name: dict.tools.resim.name,
      desc: dict.tools.resim.desc,
      tag: dict.tags.cli,
      url: 'https://docs.radixdlt.com/docs/resim-radix-engine-simulator',
      code: (
        <>
          <span className="text-[var(--code-comment)] font-bold">{dict.comments.resimSection1}</span><br />
          &nbsp;&nbsp;<span className="text-[var(--code-comment)]">{dict.comments.resimReset}</span><br />
          &nbsp;&nbsp;<span className="text-[var(--code-type)]">resim</span> reset<br /><br />
          &nbsp;&nbsp;<span className="text-[var(--code-comment)]">{dict.comments.resimNewAccount}</span><br />
          &nbsp;&nbsp;<span className="text-[var(--code-type)]">resim</span> new-account<br /><br />
          &nbsp;&nbsp;<span className="text-[var(--code-comment)]">{dict.comments.resimShowConfigs}</span><br />
          &nbsp;&nbsp;<span className="text-[var(--code-type)]">resim</span> show-configs<br /><br />
          &nbsp;&nbsp;<span className="text-[var(--code-comment)]">{dict.comments.resimShowEntity}</span><br />
          &nbsp;&nbsp;<span className="text-[var(--code-type)]">resim</span> show<br /><br />

          <span className="text-[var(--code-comment)] font-bold">{dict.comments.resimSection2}</span><br />
          &nbsp;&nbsp;<span className="text-[var(--code-comment)]">{dict.comments.resimTokenFixed}</span><br />
          &nbsp;&nbsp;<span className="text-[var(--code-type)]">resim</span> new-token-fixed --name <span className="text-[var(--code-string)]">&quot;Dolar&quot;</span> --symbol <span className="text-[var(--code-string)]">&quot;USD&quot;</span> 1000<br /><br />
          &nbsp;&nbsp;<span className="text-[var(--code-comment)]">{dict.comments.resimBadgeFixed}</span><br />
          &nbsp;&nbsp;<span className="text-[var(--code-type)]">resim</span> new-badge-fixed --name <span className="text-[var(--code-string)]">&quot;Admin Badge&quot;</span> 1<br /><br />
          &nbsp;&nbsp;<span className="text-[var(--code-comment)]">{dict.comments.resimTokenMutable}</span><br />
          &nbsp;&nbsp;<span className="text-[var(--code-type)]">resim</span> new-token-mutable --name <span className="text-[var(--code-string)]">&quot;Puntos&quot;</span> --symbol <span className="text-[var(--code-string)]">&quot;PTS&quot;</span> {"<BADGE_ADDR>"}<br /><br />
          &nbsp;&nbsp;<span className="text-[var(--code-comment)]">{dict.comments.resimMint}</span><br />
          &nbsp;&nbsp;<span className="text-[var(--code-type)]">resim</span> mint 500 {"<MUTABLE_TOKEN_ADDR>"}
        </>
      )
    },
    {
      name: dict.tools.core.name,
      desc: dict.tools.core.desc,
      tag: dict.tags.cli,
      url: 'https://github.com/radixdlt/babylon-nodecli',
      code: (
        <>
          <span className="text-[var(--code-comment)]">{dict.comments.coreStep1}</span><br />
          &nbsp;&nbsp;<span className="text-[var(--code-type)]">babylonnode</span> systemd dependencies<br />
          &nbsp;&nbsp;<span className="text-[var(--code-type)]">sudo su</span><br />
          &nbsp;&nbsp;echo <span className="text-[var(--code-string)]">&quot;radixdlt ALL=(ALL) NOPASSWD:ALL&quot;</span> &gt; /etc/sudoers.d/radixdlt<br />
          &nbsp;&nbsp;<span className="text-[var(--code-type)]">exit</span><br /><br />
          <span className="text-[var(--code-comment)]">{dict.comments.coreStep2}</span><br />
          &nbsp;&nbsp;<span className="text-[var(--code-type)]">sudo su -</span> radixdlt<br />
          &nbsp;&nbsp;<span className="text-[var(--code-type)]">cd</span> /home/radixdlt<br />
          &nbsp;&nbsp;<span className="text-[var(--code-type)]">babylonnode</span> systemd config -m CORE<br /><br />
          <span className="text-[var(--code-comment)]">{dict.comments.coreStep3}</span><br />
          &nbsp;&nbsp;<span className="text-[var(--code-keyword)]">EXTERNAL_IP</span>=<span className="text-[var(--code-string)]">&quot;{dict.comments.coreIPPlaceholder}&quot;</span><br />
          &nbsp;&nbsp;<span className="text-[var(--code-keyword)]">MAINNET_SEEDS</span>=<span className="text-[var(--code-string)]">&quot;radix://node_rdx1qf2x63qx4jdaxj83kkw2yytehvvmu6r2xll5gcp6c9rancmrfsgfw0vnc65@babylon-mainnet-eu-west-1-node0.radixdlt.com&quot;</span><br />
          &nbsp;&nbsp;<span className="text-[var(--code-keyword)]">STOKENET_SEEDS</span>=<span className="text-[var(--code-string)]">&quot;radix://node_tdx_2_1qv89yg0la2jt429vqp8sxtpg95hj637gards67gpgqy2vuvwe4s5ss0va2y@babylon-stokenet-ap-south-1-node0.radixdlt.com&quot;</span><br />
          &nbsp;&nbsp;<span className="text-[var(--code-type)]">babylonnode</span> systemd install -i <span className="text-[var(--code-keyword)]">$EXTERNAL_IP</span> -t <span className="text-[var(--code-keyword)]">$MAINNET_SEEDS</span><br /><br />
          <span className="text-[var(--code-comment)]">{dict.comments.coreStep4}</span><br />
          &nbsp;&nbsp;<span className="text-[var(--code-type)]">babylonnode</span> auth set-admin-password --setupmode SYSTEMD<br />
          &nbsp;&nbsp;<span className="text-[var(--code-type)]">babylonnode</span> auth set-metrics-password --setupmode SYSTEMD<br />
          &nbsp;&nbsp;echo <span className="text-[var(--code-string)]">&apos;export NGINX_ADMIN_PASSWORD=&quot;nginx-password&quot;&apos;</span> &gt;&gt; ~/.bashrc<br />
          &nbsp;&nbsp;echo <span className="text-[var(--code-string)]">&apos;export NGINX_METRICS_PASSWORD=&quot;nginx-password&quot;&apos;</span> &gt;&gt; ~/.bashrc<br />
          &nbsp;&nbsp;<span className="text-[var(--code-type)]">source</span> ~/.bashrc<br /><br />
          <span className="text-[var(--code-comment)]">{dict.comments.coreStep5}</span><br />
          &nbsp;&nbsp;<span className="text-[var(--code-type)]">babylonnode</span> api system health<br />
          &nbsp;&nbsp;<span className="text-[var(--code-type)]">curl</span> -k -u <span className="text-[var(--code-string)]">&quot;admin:nginx-password&quot;</span> https://127.0.0.1/core/status/network-status \<br />
          &nbsp;&nbsp;&nbsp;&nbsp;-X POST -H <span className="text-[var(--code-string)]">&apos;Content-Type: application/json&apos;</span> \<br />
          &nbsp;&nbsp;&nbsp;&nbsp;--data <span className="text-[var(--code-string)]">&apos;{"{"}&quot;network&quot;: &quot;mainnet&quot;{"}"}&apos;</span> | <span className="text-[var(--code-type)]">jq</span><br /><br />
          <span className="text-[var(--code-comment)]">{dict.comments.coreStep6}</span><br />
          &nbsp;&nbsp;<span className="text-[var(--code-type)]">babylonnode</span> systemd stop<br />
          &nbsp;&nbsp;<span className="text-[var(--code-type)]">babylonnode</span> systemd restart
        </>
      )
    },
    {
      name: dict.tools.gateway.name,
      desc: dict.tools.gateway.desc,
      tag: dict.tags.stable,
      url: 'https://github.com/radixdlt/babylon-gateway/tree/main/sdk/typescript/',
      code: (
        <>
          &nbsp;&nbsp;<span className="text-[var(--code-keyword)] font-bold">$</span> <span className="text-[var(--code-type)]">npm</span> i @radixdlt/babylon-gateway-api-sdk<br /><br />
          <span className="text-[var(--code-keyword)]">import</span> <span className="text-[var(--code-punct)]">{"{"}</span> <span className="text-[var(--code-type)]">GatewayApiClient</span>, <span className="text-[var(--code-type)]">RadixNetwork</span> <span className="text-[var(--code-punct)]">{"}"}</span> <span className="text-[var(--code-keyword)]">from</span> <span className="text-[var(--code-string)]">&apos;@radixdlt/babylon-gateway-api-sdk&apos;</span><span className="text-[var(--code-punct)]">;</span><br /><br />
          <span className="text-[var(--code-keyword)]">const</span> gatewayApi <span className="text-[var(--code-punct)]">=</span> <span className="text-[var(--code-type)]">GatewayApiClient</span>.<span className="text-[var(--color-secondary)]">initialize</span>(<span className="text-[var(--code-punct)]">{"{"}</span><br />
          &nbsp;&nbsp;networkId<span className="text-[var(--code-punct)]">:</span> <span className="text-[var(--code-type)]">RadixNetwork</span>.<span className="text-[var(--code-type)]">Mainnet</span>,<br />
          &nbsp;&nbsp;applicationName<span className="text-[var(--code-punct)]">:</span> <span className="text-[var(--code-string)]">&apos;Your dApp&apos;</span>,<br />
          &nbsp;&nbsp;applicationDappDefinitionAddress<span className="text-[var(--code-punct)]">:</span> <span className="text-[var(--code-string)]">&apos;account_rdx12y4l35lh2543nfa9pyyzvsh64ssu0dv6fq20gg8suslwmjvkylejgj&apos;</span><br />
          <span className="text-[var(--code-punct)]">{"}"}</span>)<span className="text-[var(--code-punct)]">;</span><br /><br />
          <span className="text-[var(--code-keyword)]">const</span> <span className="text-[var(--code-punct)]">{"{"}</span> status, state <span className="text-[var(--code-punct)]">{"}"}</span> <span className="text-[var(--code-punct)]">=</span> gatewayApi<span className="text-[var(--code-punct)]">;</span>
        </>
      )
    },
    {
      name: dict.tools.ts.name,
      desc: dict.tools.ts.desc,
      tag: dict.tags.stable,
      url: 'https://github.com/radixdlt/typescript-radix-engine-toolkit',
      code: (
        <>
          <span className="text-[var(--code-keyword)]">import</span> <span className="text-[var(--code-punct)]">{" {"}</span> <span className="text-[var(--code-type)]">ManifestBuilder</span>, <span className="text-[var(--code-keyword)]">address</span>, <span className="text-[var(--code-keyword)]">bucket</span>, <span className="text-[var(--code-keyword)]">decimal</span> <span className="text-[var(--code-punct)]">{"} "}</span> <span className="text-[var(--code-keyword)]">from</span> <span className="text-[var(--code-string)]">&quot;@radixdlt/radix-engine-toolkit&quot;</span>;<br /><br />
          <span className="text-[var(--code-keyword)]">const</span> manifest <span className="text-[var(--code-punct)]">=</span> <span className="text-[var(--code-keyword)]">new</span> <span className="text-[var(--code-type)]">ManifestBuilder</span>()<br />
          &nbsp;&nbsp;.<span className="text-[var(--color-secondary)]">callMethod</span>(<br />
          &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-[var(--code-string)]">&quot;account_sim1c9ye…v64gahs&quot;</span>,<br />
          &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-[var(--code-string)]">&quot;withdraw&quot;</span>,<br />
          &nbsp;&nbsp;&nbsp;&nbsp;[<br />
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-[var(--code-keyword)]">address</span>(<span className="text-[var(--code-string)]">&quot;resource_sim1thzv…y0y0exq&quot;</span>),<br />
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-[var(--code-keyword)]">decimal</span>(<span className="text-[var(--code-string)]">10</span>),<br />
          &nbsp;&nbsp;&nbsp;&nbsp;]<br />
          &nbsp;&nbsp;)<br />
          &nbsp;&nbsp;.<span className="text-[var(--color-secondary)]">takeAllFromWorktop</span>(<br />
          &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-[var(--code-string)]">&quot;resource_sim1thzv…y0y0exq&quot;</span>,<br />
          &nbsp;&nbsp;&nbsp;&nbsp;(builder, bucketId) =&gt;<br />
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;builder.<span className="text-[var(--color-secondary)]">callMethod</span>(<br />
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-[var(--code-string)]">&quot;account_sim1cxt6...fpm3sj&quot;</span>,<br />
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-[var(--code-string)]">&quot;try_deposit_or_abort&quot;</span>,<br />
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[<span className="text-[var(--code-keyword)]">bucket</span>(bucketId)]<br />
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)<br />
          &nbsp;&nbsp;)<br />
          &nbsp;&nbsp;.<span className="text-[var(--color-secondary)]">build</span>();<br />
          <span className="text-[var(--code-type)]">console</span>.<span className="text-[var(--color-secondary)]">log</span>(manifest.<span className="text-[var(--color-secondary)]">toString</span>());
        </>
      )
    },
    {
      name: dict.tools.dapp.name,
      desc: dict.tools.dapp.desc,
      tag: dict.tags.web3,
      url: 'https://github.com/radixdlt/radix-dapp-toolkit/blob/main/packages/dapp-toolkit/README.md',
      code: (
        <>
          &nbsp;&nbsp;<span className="text-[var(--code-keyword)] font-bold">$</span> <span className="text-[var(--code-type)]">npm</span> install @radixdlt/radix-dapp-toolkit<br /><br />
          <span className="text-[var(--code-keyword)]">import</span> <span className="text-[var(--code-punct)]">{"{"}</span> <span className="text-[var(--code-type)]">RadixDappToolkit</span>, <span className="text-[var(--code-type)]">RadixNetwork</span>, <span className="text-[var(--code-type)]">Logger</span> <span className="text-[var(--code-punct)]">{"}"}</span> <span className="text-[var(--code-keyword)]">from</span> <span className="text-[var(--code-string)]">&apos;@radixdlt/radix-dapp-toolkit&apos;</span><span className="text-[var(--code-punct)]">;</span><br /><br />
          <span className="text-[var(--code-keyword)]">const</span> rdt <span className="text-[var(--code-punct)]">=</span> <span className="text-[var(--code-type)]">RadixDappToolkit</span>(<span className="text-[var(--code-punct)]">{"{"}</span><br />
          &nbsp;&nbsp;dAppDefinitionAddress<span className="text-[var(--code-punct)]">:</span> <span className="text-[var(--code-string)]">&apos;account_rdx1...&apos;</span>,<br />
          &nbsp;&nbsp;networkId<span className="text-[var(--code-punct)]">:</span> <span className="text-[var(--code-type)]">RadixNetwork</span>.<span className="text-[var(--code-type)]">Mainnet</span>,<br />
          &nbsp;&nbsp;applicationName<span className="text-[var(--code-punct)]">:</span> <span className="text-[var(--code-string)]">&apos;Radix Web3 dApp&apos;</span>,<br />
          &nbsp;&nbsp;applicationVersion<span className="text-[var(--code-punct)]">:</span> <span className="text-[var(--code-string)]">&apos;1.0.0&apos;</span>,<br />
          &nbsp;&nbsp;logger<span className="text-[var(--code-punct)]">:</span> <span className="text-[var(--code-type)]">Logger</span>(1)<br />
          <span className="text-[var(--code-punct)]">{"}"}</span>)<span className="text-[var(--code-punct)]">;</span>
        </>
      )
    }
  ];


  const activeTool = tools[activeIdx];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.12fr_0.88fr] gap-8 items-stretch">

      {/* Panel Izquierdo: Terminal limpia con los códigos reales */}
      <div className="bg-[var(--color-bg)] border border-[var(--color-card-border)] p-8 rounded-xl shadow-sm h-full flex flex-col min-w-0">
        <div className="mb-6 flex-none">
          <h3 className="text-[var(--color-text-main)] font-bold text-xl flex items-center gap-2">
            <Terminal className="size-5 text-[var(--color-primary)]" />
            {activeTool.name}
          </h3>
          <p className="text-sm text-[var(--color-text-muted)] mt-2">
            {activeTool.desc}
          </p>
        </div>

        {/* Bloque de código */}
        <div className="bg-[var(--code-bg)] border border-[var(--color-card-border)] rounded-lg p-6 font-mono text-sm leading-relaxed text-[var(--color-text-main)] shadow-inner flex-grow overflow-x-hidden overflow-y-auto whitespace-pre-wrap break-words min-h-0 h-0">
          <div key={activeIdx} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            {activeTool.code}
          </div>
        </div>
      </div>

      {/* Panel Derecho: Lista limpia y descripciones */}
      <div className="bg-[var(--color-bg)] border border-[var(--color-card-border)] p-8 rounded-xl shadow-sm h-full flex flex-col min-w-0">
        <div className="mb-6">
          <h3 className="text-[var(--color-text-main)] font-bold text-xl flex items-center gap-2">
            <BookOpen className="size-5 text-[var(--color-primary)]" />
            {dict.devTools}
          </h3>
        </div>

        <div className="space-y-4 flex-grow">
          {tools.map((tool, i) => {
            const isActive = activeIdx === i;
            return (
              <button type="button"
                key={tool.name}
                onClick={() => setActiveIdx(i)}
                className={`group w-full border-b border-[var(--color-card-border)] pb-4 flex items-center justify-between cursor-pointer transition-all text-left ${isActive ? 'opacity-100' : 'opacity-60 hover:opacity-100'
                  }`}
              >
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 text-left">
                    <span className={`font-medium transition-colors ${isActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-main)] group-hover:text-[var(--color-primary)]'}`}>
                      {tool.name}
                    </span>
                  </div>
                  <a
                    href={tool.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-opacity opacity-0 group-hover:opacity-100 p-1"
                  >
                    <ExternalLink className="size-3.5" />
                  </a>
                </div>
              </button>
            );
          })}
        </div>
      </div>

    </div>
  );
}