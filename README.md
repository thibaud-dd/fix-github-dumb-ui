# Fix GitHub Dumb UI

A Chrome extension for GitHub pull request pages:

- The Conversation and Commits tabs use the full window width. GitHub caps them at 1280px.
- Classic Files changed view: the file tree has a drag handle on its right edge. The width is saved for all PRs. Double-click the handle to reset it. The new view has its own splitter, so the extension adds no handle there.
- Classic Files changed view: diff headers show the full file path. GitHub cuts paths longer than about 93 characters on the server. The start of the path is cut only when there is not enough space.
- New Files changed view: the file path uses all free space in the diff header. By default, GitHub gives the path only half of the header.
- Stack sidebar: if a PR is part of a Graphite stack, a sidebar on the left lists the PRs in the stack with their title and state. The current PR is highlighted. A click opens the same tab on the other PR. The arrow button collapses the sidebar to a strip of state icons.

## Install

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select this folder.

After you edit a file, click the reload icon on the extension card. Then reload the GitHub tab.

## Stack sidebar setup

The sidebar reads the Graphite stack comment through the GitHub API, so it needs a token.

1. Get a token. To use your gh CLI token, run `gh auth token --user <login>`.
2. On the extension card in `chrome://extensions`, click **Details**, then **Extension options**.
3. Paste the token and click **Save**. The page shows the login that the token belongs to.

The token is stored in the extension's local storage. If GitHub rejects the token, the sidebar shows an error with a link to the options.
