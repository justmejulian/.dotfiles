# Load mise (handles Node, Python, etc.)
# https://mise.jdx.dev/cli/activate.html#mise-activate
eval "$(mise activate zsh)"

mise-init-lts() {
  mise use node@lts && node -v > .nvmrc
}
