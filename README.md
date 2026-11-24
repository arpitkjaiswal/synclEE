# synclEE

A Chrome extension that saves accepted coding solutions to a GitHub repository you choose. It includes submission adapters for LeetCode, CodeChef, HackerRank, and GeeksforGeeks. CodeChef solutions with a detected rating are grouped into 100-point bands. The popup counts successful sync commits made on the current browser profile.

## Run locally

1. Run `npm run check` and `npm test` with Node.js 22 or newer. There are no runtime dependencies to install.
2. Open `chrome://extensions`, enable **Developer mode**, and select **Load unpacked** with the `extension` directory.
3. Create a [GitHub OAuth app](https://github.com/settings/developers) and enable **Device Flow**. Use the app's client ID in synclEE.
4. Enter an initialized destination repository as `owner/name` and select **Connect GitHub**. Enter the displayed code on GitHub. Reopen the popup after authorizing so it can finish checking access.
5. Submit a solution and check the popup and destination repository after an accepted verdict.

The extension requests GitHub's OAuth `repo` scope to support public and private destinations. GitHub grants that scope at the account level, and the extension writes only to the repository you configure. It saves the access token in extension-local storage, accessible to extension pages and its service worker. To revoke access at GitHub, use **Settings → Applications → Authorized OAuth Apps**.

## Distribution

CI tests the extension and attaches a ZIP to the workflow run. The workflow also publishes a download page when GitHub Pages is configured to use **GitHub Actions**. For the Chrome Web Store, upload the extension ZIP through the developer dashboard with the required listing and privacy disclosures. Set the Actions repository variable `SYNCLEE_GITHUB_CLIENT_ID` to package a shared Device Flow–enabled OAuth app and skip manual client ID entry. Pushing a version tag publishes the ZIP to GitHub Releases.

## Capture behavior

LeetCode's supported fetch path ties the exact submitted buffer to its submission ID and waits for an accepted verdict. The DOM adapters use a Monaco or Ace buffer, or a supported code textarea, and wait for a fresh acceptance signal after clicking Submit. Site markup and editor integrations can change. Validate with an actual accepted submission on each site before distributing.
