// Config docs:
//
//   https://glide-browser.app/config
//
// API reference:
//
//   https://glide-browser.app/api
//
// Default config files can be found here:
//
//   https://github.com/glide-browser/glide/tree/main/src/glide/browser/base/content/plugins
//
// Most default keymappings are defined here:
//
//   https://github.com/glide-browser/glide/blob/main/src/glide/browser/base/content/plugins/keymaps.mts
//
// Try typing `glide.` and see what you can do!
//
// console.log log is displayed in :repl

glide.g.mapleader = "<Space>";

glide.keymaps.set("normal", "<leader>r", "config_reload");

// For YubiKey support
glide.prefs.set("security.webauth.webauthn", true);
glide.prefs.set("security.webauth.webauthn_enable_usbtoken", true);
glide.prefs.set("security.webauthn.ctap2", true);

glide.keymaps.set("normal", "<S-f>", "hint --location=browser-ui");

glide.keymaps.set("command", "<c-j>", "commandline_focus_next");
glide.keymaps.set("command", "<c-k>", "commandline_focus_back");

glide.autocmds.create(
  "UrlEnter",
  {
    hostname: "bff-api-test.sg.dss.husqvarnagroup.net",
  },
  async ({ url }) => {
    glide.buf.keymaps.set(
      "normal",
      "<leader>cl",
      glide.content.fn(async () => {
        const sessionData = localStorage.getItem("smartGardenSession");

        if (!sessionData) {
          console.error("No smartGardenSession found in local storage");
          return;
        }

        try {
          const parsed = JSON.parse(sessionData);
          const locationId = parsed.locationId;

          if (!locationId) {
            console.error("No locationId found in smartGardenSession");
            return;
          }

          await navigator.clipboard.writeText(locationId);
          console.log(`Copied location ID: ${locationId}`);
        } catch (e) {
          console.error("Failed to parse smartGardenSession:", e);
        }
      }),
      { description: "copy location ID to clipboard" },
    );
  },
);

glide.autocmds.create(
  "UrlEnter",
  /https:\/\/dev\.azure\.com\/.*\/_git\/.*\/pullrequest\/.*/,
  () => {
    glide.buf.keymaps.set(
      "normal",
      "<leader>cb",
      glide.content.fn(async () => {
        // Wait for element to load
        const waitForElement = (
          selector: string,
          timeout = 5000,
        ): Promise<Element | null> => {
          return new Promise((resolve) => {
            if (document.querySelector(selector)) {
              return resolve(document.querySelector(selector));
            }

            const observer = new MutationObserver(() => {
              if (document.querySelector(selector)) {
                observer.disconnect();
                resolve(document.querySelector(selector));
              }
            });

            observer.observe(document.body, {
              childList: true,
              subtree: true,
            });

            setTimeout(() => {
              observer.disconnect();
              resolve(null);
            }, timeout);
          });
        };

        const branchLink = await waitForElement(
          ".pr-header-branches a[href*='version=GB']",
        );

        if (branchLink) {
          const href = branchLink.getAttribute("href");
          const match = href?.match(/version=GB(.+?)(&|$)/);
          if (match) {
            const branchName = match[1];
            if (!branchName) {
              console.warn("No branch name found");
              return;
            }
            await navigator.clipboard.writeText(branchName);
            console.log(`Copied branch name: ${branchName}`);
          } else {
            console.error("Could not extract branch name from href");
          }
        } else {
          console.error("Branch link not found");
        }
      }),
      { description: "copy source branch name to clipboard" },
    );
  },
);

glide.autocmds.create(
  "UrlEnter",
  /https:\/\/dev\.azure\.com\/.*\/_build\/results.*/,
  () => {
    glide.buf.keymaps.set(
      "normal",
      "<leader>ct",
      glide.content.fn(async () => {
        const rows = document.querySelectorAll(
          ".ms-List-cell .ms-DetailsRow .clickable-text",
        );

        const tests: string[] = [];

        rows.forEach((el) => {
          const name = el.textContent?.trim();
          if (name && !/^Testem Tests/.test(name)) {
            tests.push(name);
          }
        });

        const unique = [...new Set(tests)];

        if (unique.length === 0) {
          console.warn("No failing tests found. Are results loaded?");
          return;
        }

        const text = unique.map((t, i) => `${i + 1}. ${t}`).join("\n");
        await navigator.clipboard.writeText(text);
        console.log(`Copied ${unique.length} failing test(s) to clipboard:\n${text}`);
      }),
      { description: "copy failing test names to clipboard" },
    );
  },
);

glide.autocmds.create(
  "UrlEnter",
  { hostname: "jira-husqvarna.riada.se" },
  () => {
    glide.buf.keymaps.set(
      "normal",
      "<leader>cj",
      glide.content.fn(async () => {
        const url = window.location.href;
        const match = url.match(/([A-Z]+-\d+)/);

        if (match) {
          const ticketId = match[1];
          if (ticketId) {
            await navigator.clipboard.writeText(ticketId);
            console.log(`Copied Jira ticket ID: ${ticketId}`);
            return;
          }
        }

        console.error("No Jira ticket ID found in URL");
      }),
      { description: "copy Jira ticket ID to clipboard" },
    );
  },
);
