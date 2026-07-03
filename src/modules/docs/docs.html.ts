function row(method: string, path: string, auth: boolean, desc: string): string {
  const mClass = method.toLowerCase()
  const aClass = auth ? 'auth-yes' : 'auth-no'
  const aText = auth ? 'Si' : 'No'
  const pathHtml = path.replace(/:(\w+)/g, '<span class="param">:$1</span>')
  const lock = auth ? '🔒' : '🔓'
  return '    <tr class="endpoint-row"><td><span class="method ' + mClass + '">' + method + '</span></td><td><span class="path">' + pathHtml + '</span></td><td><span class="auth-badge ' + aClass + '">' + lock + ' ' + aText + '</span></td><td class="desc">' + desc + '</td></tr>'
}

const DOCS_HEAD = '<!DOCTYPE html>\n<html lang="es">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>API Docs &mdash; Trading Academy</title>\n<style>\n  :root {\n    --bg: #0d1117;\n    --surface: #161b22;\n    --surface2: #1c2333;\n    --border: #30363d;\n    --text: #e6edf3;\n    --text-muted: #8b949e;\n    --gold: #c5a037;\n    --green: #3fb950;\n    --red: #f85149;\n    --blue: #58a6ff;\n    --purple: #bc8cff;\n    --orange: #d29922;\n    --radius: 8px;\n  }\n  * { margin:0; padding:0; box-sizing:border-box }\n  body { font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,\'Inter\',sans-serif; background:var(--bg); color:var(--text); padding:24px; line-height:1.6 }\n  .container { max-width:1200px; margin:0 auto }\n  h1 { font-size:28px; font-weight:700; margin-bottom:4px; display:flex; align-items:center; gap:12px }\n  h1 small { font-size:14px; font-weight:400; color:var(--text-muted) }\n  .subtitle { color:var(--text-muted); font-size:14px; margin-bottom:32px }\n  .stats { display:flex; gap:16px; flex-wrap:wrap; margin-bottom:32px }\n  .stat { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:16px 24px; min-width:120px }\n  .stat-value { font-size:24px; font-weight:700 }\n  .stat-label { font-size:12px; color:var(--text-muted); margin-top:2px; text-transform:uppercase }\n  .stat.purple .stat-value { color:var(--purple) }\n  .stat.green .stat-value { color:var(--green) }\n  .stat.red .stat-value { color:var(--red) }\n  .stat.blue .stat-value { color:var(--blue) }\n  .stat.gold .stat-value { color:var(--gold) }\n  .stat.orange .stat-value { color:var(--orange) }\n  h2 { font-size:18px; font-weight:600; margin:32px 0 16px; padding-bottom:8px; border-bottom:1px solid var(--border); display:flex; align-items:center; gap:8px }\n  h2 .count { font-size:12px; background:var(--surface2); color:var(--text-muted); padding:2px 8px; border-radius:12px; }\n  table { width:100%; border-collapse:collapse; margin-bottom:8px }\n  th { text-align:left; font-size:11px; text-transform:uppercase; color:var(--text-muted); padding:8px 12px; border-bottom:2px solid var(--border); font-weight:600 }\n  td { padding:10px 12px; border-bottom:1px solid var(--border); font-size:14px }\n  tr:hover { background:var(--surface) }\n  .method { display:inline-block; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:700; text-transform:uppercase; min-width:50px; text-align:center }\n  .method.get { background:#1a3a4a; color:#58a6ff }\n  .method.post { background:#1a3a2a; color:#3fb950 }\n  .method.put { background:#1a3a3a; color:#d29922 }\n  .method.delete { background:#3a1a1a; color:#f85149 }\n  .path { font-family:\'SFMono-Regular\',Consolas,\'Liberation Mono\',Menlo,monospace; font-size:13px }\n  .path .param { color:#c5a037; font-weight:600 }\n  .auth-badge { font-size:12px; padding:2px 8px; border-radius:4px; background:var(--surface2) }\n  .auth-yes { color:#3fb950 }\n  .auth-no { color:#f85149 }\n  .desc { color:var(--text-muted); font-size:13px }\n  .desc code { background:var(--surface2); padding:1px 4px; border-radius:3px; font-size:12px }\n  .search-box { width:100%; padding:10px 14px; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); color:var(--text); font-size:14px; margin-bottom:24px; outline:none }\n  .search-box:focus { border-color:var(--gold) }\n  .endpoint-row { transition: background 0.15s }\n</style>\n</head>\n<body>\n<div class="container">\n'

const DOCS_FOOT = '<div style="margin-top:40px;padding:16px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);font-size:12px;color:var(--text-muted);text-align:center">\n  Para autenticarte incluye el header <code style="background:var(--surface2);padding:2px 6px;border-radius:3px">Authorization: Bearer &lt;token&gt;</code>.\n  Obt&eacute;n un token via <code>POST /api/auth/login</code>.\n</div>\n</div>\n<script>\nfunction filter(q) {\n  q = q.toLowerCase()\n  document.querySelectorAll(\'table tbody tr\').forEach(function(r) {\n    r.style.display = r.textContent.toLowerCase().includes(q) ? \'\' : \'none\'\n  })\n}\n</script>\n</body>\n</html>'

function section(title: string, icon: string, count: number, tableId: string, rows: string): string {
  return '<h2>' + icon + ' ' + title + ' <span class="count">' + count + '</span></h2>\n<table id="' + tableId + '"><thead><tr><th style="width:70px">Metodo</th><th>Ruta</th><th>Auth</th><th style="width:45%">Descripcion</th></tr></thead><tbody>\n' + rows + '\n</tbody></table>\n'
}

function buildPage(): string {
  return DOCS_HEAD + '\n'
    + '  <h1>\n    <svg width="28" height="28" viewBox="0 0 40 40" fill="none"><polyline points="4,28 14,16 22,22 36,8" stroke="#c5a037" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="36" cy="8" r="3" fill="#c5a037"/></svg>\n    API Documentation <small>Trading Academy</small>\n  </h1>\n'
    + '  <p class="subtitle">Backend REST API &mdash; Express 5 + SQLite &mdash; <code style="background:var(--surface2);padding:2px 6px;border-radius:4px;font-size:12px">http://localhost:3008/api</code></p>\n'
    + '  <div class="stats">\n    <div class="stat purple"><div class="stat-value">59</div><div class="stat-label">Total endpoints</div></div>\n    <div class="stat green"><div class="stat-value">3</div><div class="stat-label">Publicos</div></div>\n    <div class="stat red"><div class="stat-value">56</div><div class="stat-label">Requieren auth</div></div>\n    <div class="stat blue"><div class="stat-value">28</div><div class="stat-label">GET</div></div>\n    <div class="stat gold"><div class="stat-value">16</div><div class="stat-label">POST</div></div>\n    <div class="stat orange"><div class="stat-value">12</div><div class="stat-label">PUT</div></div>\n    <div class="stat" style="border-color:var(--red)"><div class="stat-value">8</div><div class="stat-label">DELETE</div></div>\n  </div>\n'
    + '  <input class="search-box" id="search" placeholder="Buscar endpoints por metodo, ruta o descripcion..." oninput="filter(this.value)">\n\n'

    + section('Auth', '🔐', 5, 't-auth',
        row('POST','/api/auth/register',false,'Registra un nuevo usuario con <code>name</code>, <code>username</code>, <code>email</code>, <code>password</code>. Devuelve usuario + token.')
      + row('POST','/api/auth/login',false,'Autentica al usuario con <code>email</code> / <code>password</code>. Devuelve usuario + token.')
      + row('GET','/api/auth/supabase-config',false,'Indica si Supabase esta configurado.')
      + row('GET','/api/auth/me',true,'Devuelve el perfil del usuario autenticado (token Bearer).')
      + row('POST','/api/auth/logout',true,'Invalida el token de sesion actual.')
    )

    + section('Usuarios', '👥', 3, 't-users',
        row('GET','/api/users',true,'Lista todos los usuarios.')
      + row('GET','/api/users/counts',true,'Conteo de usuarios por rol.')
      + row('PUT','/api/users/profile',true,'Actualiza <code>name</code> y/o <code>username</code> del usuario autenticado.')
    )

    + section('Lecciones', '📚', 6, 't-lessons',
        row('GET','/api/lessons',true,'Lista todas las lecciones con nombre del profesor.')
      + row('GET','/api/lessons/count',true,'Conteo total de lecciones.')
      + row('GET','/api/lessons/teacher',true,'Lecciones del profesor autenticado.')
      + row('POST','/api/lessons',true,'Crea una leccion.')
      + row('PUT','/api/lessons/:id',true,'Actualiza una leccion (solo dueno).')
      + row('DELETE','/api/lessons/:id',true,'Elimina una leccion (solo dueno).')
    )

    + section('Tareas', '📋', 6, 't-tasks',
        row('GET','/api/tasks',true,'Lista todas las tareas con nombre del profesor.')
      + row('GET','/api/tasks/count',true,'Conteo total de tareas.')
      + row('GET','/api/tasks/teacher',true,'Tareas del profesor autenticado.')
      + row('POST','/api/tasks',true,'Crea una tarea.')
      + row('PUT','/api/tasks/:id',true,'Actualiza una tarea (solo dueno).')
      + row('DELETE','/api/tasks/:id',true,'Elimina una tarea (solo dueno).')
    )

    + section('Reuniones', '📅', 7, 't-meetings',
        row('GET','/api/meetings',true,'Lista todas las reuniones con profesor.')
      + row('GET','/api/meetings/count',true,'Conteo total de reuniones.')
      + row('GET','/api/meetings/teacher',true,'Reuniones del profesor autenticado.')
      + row('GET','/api/meetings/next',true,'Proxima reunion (fecha > ahora).')
      + row('POST','/api/meetings',true,'Crea una reunion.')
      + row('PUT','/api/meetings/:id',true,'Actualiza una reunion (solo dueno).')
      + row('DELETE','/api/meetings/:id',true,'Elimina una reunion (solo dueno).')
    )

    + section('Anuncios', '📢', 4, 't-announcements',
        row('GET','/api/announcements',true,'Lista anuncios con profesor. Soporta <code>?limit=N</code>.')
      + row('GET','/api/announcements/teacher',true,'Anuncios del profesor autenticado.')
      + row('POST','/api/announcements',true,'Crea un anuncio.')
      + row('DELETE','/api/announcements/:id',true,'Elimina un anuncio (solo dueno).')
    )

    + section('Entregas', '📝', 5, 't-submissions',
        row('GET','/api/submissions/task/:taskId',true,'Entregas de una tarea, con nombre del estudiante.')
      + row('GET','/api/submissions/student/:studentId',true,'Entregas de un estudiante.')
      + row('GET','/api/submissions/summary',true,'Resumen ligero de entregas.')
      + row('POST','/api/submissions',true,'Crea o actualiza (upsert) una entrega.')
      + row('PUT','/api/submissions/:id/grade',true,'Asigna/actualiza la calificacion.')
    )

    + section('Cursos', '🎓', 14, 't-courses',
        row('GET','/api/courses',true,'Lista todos los cursos.')
      + row('GET','/api/courses/teacher',true,'Cursos del profesor autenticado.')
      + row('GET','/api/courses/student/:studentId',true,'Cursos de un estudiante.')
      + row('GET','/api/courses/:id',true,'Curso individual por ID.')
      + row('POST','/api/courses',true,'Crea un curso.')
      + row('PUT','/api/courses/:id',true,'Actualiza un curso (solo dueno).')
      + row('DELETE','/api/courses/:id',true,'Elimina curso y datos asociados.')
      + row('POST','/api/courses/:courseId/lessons',true,'Agrega una leccion al curso.')
      + row('PUT','/api/courses/:courseId/lessons/:lessonId',true,'Actualiza leccion del curso.')
      + row('DELETE','/api/courses/:courseId/lessons/:lessonId',true,'Elimina leccion del curso.')
      + row('POST','/api/courses/:courseId/meetings',true,'Agrega reunion al curso.')
      + row('DELETE','/api/courses/:courseId/meetings/:meetingId',true,'Elimina reunion del curso.')
      + row('POST','/api/courses/:courseId/enroll',true,'Inscribe al usuario autenticado.')
      + row('POST','/api/courses/:courseId/toggle-block/:studentId',true,'Activa/desactiva bloqueo.')
    )

    + section('Progreso', '📊', 2, 't-progress',
        row('PUT','/api/progress/:courseId/:lessonId',true,'Marca leccion como completada/no completada.')
      + row('GET','/api/progress/:courseId',true,'Progreso del estudiante en un curso.')
    )

    + section('Notificaciones', '🔔', 4, 't-notifications',
        row('GET','/api/notifications',true,'Lista notificaciones del usuario.')
      + row('GET','/api/notifications/unread-count',true,'Conteo de no leidas.')
      + row('PUT','/api/notifications/:id/read',true,'Marca una como leida.')
      + row('PUT','/api/notifications/read-all',true,'Marca todas como leidas.')
    )

    + section('DB Viewer', '🗄️', 3, 't-db',
        row('GET','/api/db/tables',true,'Lista las tablas SQLite.')
      + row('GET','/api/db/table/:name',true,'Hasta 200 filas de una tabla (whitelist).')
      + row('POST','/api/db/query',true,'Ejecuta SELECT arbitrario (solo admin).')
    )

    + DOCS_FOOT
}

export const DOCS_HTML: string = buildPage()
