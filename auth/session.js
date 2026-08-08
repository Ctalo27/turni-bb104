/* ═══ SESSIONE UTENTE ═══
   Oggi l'app non ha login: dati locali, nessun account. Questo modulo isola il
   concetto di "utente/sessione" dietro un'interfaccia minima, così che in futuro
   un eventuale SSO aziendale (es. provider OIDC/SAML) si agganci qui, senza
   toccare il resto del codice e senza costruire un sistema di password proprio. */
function getCurrentUser(){return null;}
function isAuthenticated(){return true;}
