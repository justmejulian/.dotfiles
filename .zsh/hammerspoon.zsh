# Pick and apply a Hammerspoon layout (see ~/.hammerspoon/README.md)
hs-layout() {
  hs -c "hs.inspect(require('modules.layouts').list())" \
    | tr -d '{"} ' | tr ',' '\n' \
    | fzf --prompt='layout> ' \
    | xargs -I{} hs -c "require('modules.layouts').apply('{}')"
}
