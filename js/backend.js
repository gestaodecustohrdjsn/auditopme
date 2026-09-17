const URL_KEY = "auditopme_backend_url";
const TOKEN_KEY = "auditopme_backend_token";

export function getBackendConfig() {
  return {
    url: localStorage.getItem(URL_KEY) || "",
    token: sessionStorage.getItem(TOKEN_KEY) || "",
  };
}

export function saveBackendConfig({ url, token }) {
  const normalized = normalizeUrl(url);
  if (normalized) localStorage.setItem(URL_KEY, normalized);
  else localStorage.removeItem(URL_KEY);

  if (token) sessionStorage.setItem(TOKEN_KEY, token.trim());
  else sessionStorage.removeItem(TOKEN_KEY);

  return getBackendConfig();
}

export function clearBackendToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

export async function backendRequest(action, payload = {}, options = {}) {
  const { url, token } = getBackendConfig();
  if (!url) throw new Error("URL do Apps Script não configurada.");
  if (!token) throw new Error("Token de acesso não informado.");

  const requestId = crypto.randomUUID();
  const body = {
    action,
    requestId,
    token,
    payload,
    client: {
      app: "AuditOPME",
      version: "0.3.0",
      sentAt: new Date().toISOString(),
    },
  };

  await fetch(url, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=UTF-8" },
    body: JSON.stringify(body),
  });

  return pollJob(url, requestId, options.timeout ?? 30000);
}

function normalizeUrl(value) {
  const url = String(value || "").trim();
  if (!url) return "";
  return url.replace(/\/+$/, "");
}

async function pollJob(url, requestId, timeoutMs) {
  const started = Date.now();
  let lastError = null;

  while (Date.now() - started < timeoutMs) {
    try {
      const job = await jsonpStatus(url, requestId);
      if (job?.state === "done") {
        if (!job.ok) throw new Error(job.error || "O backend recusou a operação.");
        return job.result;
      }
    } catch (error) {
      lastError = error;
    }
    await delay(450);
  }

  if (lastError) throw lastError;
  throw new Error("O Apps Script não respondeu dentro do tempo esperado.");
}

function jsonpStatus(url, requestId) {
  return new Promise((resolve, reject) => {
    const callbackName = `__auditopme_${requestId.replace(/[^a-zA-Z0-9_]/g, "_")}`;
    const script = document.createElement("script");
    const timer = setTimeout(() => cleanup(new Error("Falha ao consultar o status do backend.")), 8000);

    function cleanup(error, value) {
      clearTimeout(timer);
      script.remove();
      try { delete window[callbackName]; } catch (_) { window[callbackName] = undefined; }
      if (error) reject(error);
      else resolve(value);
    }

    window[callbackName] = data => cleanup(null, data);
    script.onerror = () => cleanup(new Error("Não foi possível acessar o Apps Script."));

    const query = new URLSearchParams({
      action: "status",
      requestId,
      callback: callbackName,
      _: String(Date.now()),
    });
    script.src = `${url}?${query.toString()}`;
    document.head.appendChild(script);
  });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
