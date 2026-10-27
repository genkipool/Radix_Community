// The Radix engine supplies Scrypto's imports at runtime. Newer Rust no longer
// leaves undefined wasm imports to the linker by default, so allow them.
fn main() {
    if std::env::var("TARGET").map(|t| t.starts_with("wasm32")).unwrap_or(false) {
        println!("cargo:rustc-link-arg=--allow-undefined");
    }
}
