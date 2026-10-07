const TOKEN_KEY = 'githubToken';

const savedView = document.getElementById('saved-view');
const editView = document.getElementById('edit-view');
const input = document.getElementById('token');
const status = document.getElementById('status');
const editError = document.getElementById('edit-error');
const cancelButton = document.getElementById('cancel');

let hasToken = false;

function showStatus(text, kind = 'info') {
  status.textContent = text;
  status.dataset.kind = kind;
}

function showSavedView(token) {
  hasToken = true;
  editView.hidden = true;
  savedView.hidden = false;
  showStatus('Checking the token…');
  chrome.runtime.sendMessage({ type: 'validateToken', token }, ({ login, error }) => {
    if (login) {
      showStatus(`Connected as ${login}.`);
    } else {
      showStatus(error, 'error');
    }
  });
}

function showEditView() {
  savedView.hidden = true;
  editView.hidden = false;
  editError.hidden = true;
  cancelButton.hidden = !hasToken;
  input.value = '';
  input.focus();
}

chrome.storage.local.get(TOKEN_KEY, (items) => {
  const token = items[TOKEN_KEY];
  if (token) {
    showSavedView(token);
  } else {
    showEditView();
  }
});

document.getElementById('change').addEventListener('click', showEditView);

cancelButton.addEventListener('click', () => {
  chrome.storage.local.get(TOKEN_KEY, (items) => showSavedView(items[TOKEN_KEY]));
});

document.getElementById('remove').addEventListener('click', async () => {
  await chrome.storage.local.remove(TOKEN_KEY);
  hasToken = false;
  showEditView();
});

editView.addEventListener('submit', async (event) => {
  event.preventDefault();
  const token = input.value.trim();
  if (!token) {
    editError.textContent = 'Enter a token.';
    editError.hidden = false;
    return;
  }
  await chrome.storage.local.set({ [TOKEN_KEY]: token });
  showSavedView(token);
});
