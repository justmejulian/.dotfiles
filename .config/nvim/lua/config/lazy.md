# lazy.nvim

[lazy.nvim](https://lazy.folke.io) is a modern plugin manager for Neovim.

## setup

See [spec setup](https://lazy.folke.io/spec#spec-setup) for details.
Add the most important here.

> [!IMPORTANT]
> Always use opts instead of config when possible. config is almost never needed.

```
{ "folke/todo-comments.nvim", opts = {} },
```

instead of

```
{
  "folke/todo-comments.nvim",
  config = function()
    require("todo-comments").setup({})
  end,
},
```

### config

config is executed when the plugin loads.

add commands you want run here.
