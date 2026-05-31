$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$manifestPath = Join-Path $repoRoot "programs\cryptoseeds_protocol\Cargo.toml"
$cargoBin = Join-Path $env:USERPROFILE ".cargo\bin"
$llvmMingwBin = Join-Path $env:USERPROFILE ".toolchains\llvm-mingw\bin"
$toolchain = "stable-x86_64-pc-windows-gnullvm"

if (!(Test-Path (Join-Path $cargoBin "rustup.exe"))) {
    throw "rustup.exe was not found at $cargoBin. Install Rustup first."
}

if (!(Test-Path (Join-Path $llvmMingwBin "x86_64-w64-mingw32-clang.exe"))) {
    throw "LLVM-MinGW linker was not found at $llvmMingwBin."
}

$env:Path = "$llvmMingwBin;$cargoBin;$env:Path"

& rustup run $toolchain cargo test --manifest-path $manifestPath
exit $LASTEXITCODE
