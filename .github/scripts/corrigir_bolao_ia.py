from pathlib import Path

path = Path("bolao.html")
text = path.read_text(encoding="utf-8")
original = text

ensure_user = """  async function ensureUser(user){if(!user)return null; const ref=db.collection('usuarios').doc(user.uid),snap=await ref.get(),old=snap.exists?(snap.data()||{}):{}; const payload={uid:user.uid,nome:user.displayName||old.nome||user.email||'Usuário',email:user.email||old.email||'',foto:user.photoURL||old.foto||'',ativo:old.ativo!==false,status:old.status||'ATIVO',perfil:old.perfil||old.perfilGlobal||'USUARIO',perfilGlobal:old.perfilGlobal||old.perfil||'USUARIO',ultimoLoginEm:firebase.firestore.FieldValue.serverTimestamp(),atualizadoEm:firebase.firestore.FieldValue.serverTimestamp()}; if(!snap.exists)payload.criadoEm=firebase.firestore.FieldValue.serverTimestamp(); await ref.set(payload,{merge:true}); return payload}\n"""

if "async function ensureUser(user)" not in text:
    marker = "  function atualizarAuthUI(user,perfil){"
    if marker not in text:
        raise SystemExit("Ponto de restauração da autenticação não localizado.")
    text = text.replace(marker, ensure_user + marker, 1)

required = [
    "V057_DESAFIANTE_IA_TODOS_JOGOS_PA_NO_FECHAMENTO",
    "async function garantirPalpitesDesafiante",
    "async function gravarPANoFechamento",
    "function applyPAIfNeeded",
    "async function ensureUser(user)",
]
for item in required:
    if item not in text:
        raise SystemExit(f"Validação falhou: {item}")

if text == original:
    print("bolao.html já estava íntegro")
else:
    path.write_text(text, encoding="utf-8")
    print("autenticação restaurada no bolao.html")
