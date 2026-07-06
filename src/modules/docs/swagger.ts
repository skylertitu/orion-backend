const API_BASE = "/api"

export const swaggerSpec = {
  openapi: "3.0.3",
  info: {
    title: "Trading Academy API",
    version: "1.0.0",
    description: "Backend REST API — Express 5 + SQLite",
  },
  servers: [{ url: `http://localhost:3008`, description: "Local dev" }],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: { type: "string" },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    "/api/health": {
      get: {
        tags: ["Health"],
        summary: "Health check",
        security: [],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string" },
                    timestamp: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },

    "/api/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Registrar nuevo usuario",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "username", "email", "password"],
                properties: {
                  name: { type: "string" },
                  username: { type: "string" },
                  email: { type: "string", format: "email" },
                  password: { type: "string", minLength: 6 },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Usuario creado" },
          "409": { description: "Email o username ya existe" },
        },
      },
    },
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Iniciar sesión",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string" },
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Login exitoso, devuelve token" },
          "401": { description: "Credenciales inválidas" },
        },
      },
    },
    "/api/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Cerrar sesión",
        responses: { "200": { description: "Sesión cerrada" } },
      },
    },
    "/api/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Perfil del usuario autenticado",
        responses: { "200": { description: "Datos del usuario" } },
      },
    },

    "/api/users": {
      get: {
        tags: ["Users"],
        summary: "Listar todos los usuarios",
        responses: { "200": { description: "Array de usuarios" } },
      },
    },
    "/api/users/counts": {
      get: {
        tags: ["Users"],
        summary: "Conteo de usuarios por rol",
        responses: { "200": { description: "Conteos" } },
      },
    },
    "/api/users/profile": {
      put: {
        tags: ["Users"],
        summary: "Actualizar perfil propio",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  username: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Perfil actualizado" } },
      },
    },

    "/api/lessons": {
      get: {
        tags: ["Lessons"],
        summary: "Listar todas las lecciones",
        responses: { "200": { description: "Array de lecciones" } },
      },
      post: {
        tags: ["Lessons"],
        summary: "Crear una lección",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["title"],
                properties: {
                  title: { type: "string" },
                  content: { type: "string" },
                  date: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Lección creada" } },
      },
    },
    "/api/lessons/count": {
      get: {
        tags: ["Lessons"],
        summary: "Conteo total de lecciones",
        responses: { "200": { description: "Número total" } },
      },
    },
    "/api/lessons/teacher": {
      get: {
        tags: ["Lessons"],
        summary: "Lecciones del profesor autenticado",
        responses: { "200": { description: "Array de lecciones" } },
      },
    },
    "/api/lessons/{id}": {
      put: {
        tags: ["Lessons"],
        summary: "Actualizar una lección",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  content: { type: "string" },
                  date: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Lección actualizada" } },
      },
      delete: {
        tags: ["Lessons"],
        summary: "Eliminar una lección",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Lección eliminada" } },
      },
    },

    "/api/tasks": {
      get: {
        tags: ["Tasks"],
        summary: "Listar todas las tareas",
        responses: { "200": { description: "Array de tareas" } },
      },
      post: {
        tags: ["Tasks"],
        summary: "Crear una tarea",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["title"],
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  due_date: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Tarea creada" } },
      },
    },
    "/api/tasks/count": {
      get: {
        tags: ["Tasks"],
        summary: "Conteo total de tareas",
        responses: { "200": { description: "Número total" } },
      },
    },
    "/api/tasks/teacher": {
      get: {
        tags: ["Tasks"],
        summary: "Tareas del profesor autenticado",
        responses: { "200": { description: "Array de tareas" } },
      },
    },
    "/api/tasks/{id}": {
      put: {
        tags: ["Tasks"],
        summary: "Actualizar una tarea",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  due_date: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Tarea actualizada" } },
      },
      delete: {
        tags: ["Tasks"],
        summary: "Eliminar una tarea",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Tarea eliminada" } },
      },
    },

    "/api/meetings": {
      get: {
        tags: ["Meetings"],
        summary: "Listar todas las reuniones",
        responses: { "200": { description: "Array de reuniones" } },
      },
      post: {
        tags: ["Meetings"],
        summary: "Crear una reunión",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["title"],
                properties: {
                  title: { type: "string" },
                  date: { type: "string" },
                  time: { type: "string" },
                  link: { type: "string" },
                  is_live_class: { type: "integer" },
                  platform: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Reunión creada" } },
      },
    },
    "/api/meetings/count": {
      get: {
        tags: ["Meetings"],
        summary: "Conteo total de reuniones",
        responses: { "200": { description: "Número total" } },
      },
    },
    "/api/meetings/teacher": {
      get: {
        tags: ["Meetings"],
        summary: "Reuniones del profesor autenticado",
        responses: { "200": { description: "Array de reuniones" } },
      },
    },
    "/api/meetings/next": {
      get: {
        tags: ["Meetings"],
        summary: "Próxima reunión",
        responses: { "200": { description: "Próxima reunión o null" } },
      },
    },
    "/api/meetings/{id}": {
      put: {
        tags: ["Meetings"],
        summary: "Actualizar una reunión",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  date: { type: "string" },
                  time: { type: "string" },
                  link: { type: "string" },
                  is_live_class: { type: "integer" },
                  platform: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Reunión actualizada" } },
      },
      delete: {
        tags: ["Meetings"],
        summary: "Eliminar una reunión",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Reunión eliminada" } },
      },
    },

    "/api/announcements": {
      get: {
        tags: ["Announcements"],
        summary: "Listar anuncios",
        parameters: [
          { name: "limit", in: "query", schema: { type: "integer" } },
        ],
        responses: { "200": { description: "Array de anuncios" } },
      },
      post: {
        tags: ["Announcements"],
        summary: "Crear un anuncio",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["content"],
                properties: { content: { type: "string" } },
              },
            },
          },
        },
        responses: { "201": { description: "Anuncio creado" } },
      },
    },
    "/api/announcements/teacher": {
      get: {
        tags: ["Announcements"],
        summary: "Anuncios del profesor autenticado",
        responses: { "200": { description: "Array de anuncios" } },
      },
    },
    "/api/announcements/{id}": {
      delete: {
        tags: ["Announcements"],
        summary: "Eliminar un anuncio",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Anuncio eliminado" } },
      },
    },

    "/api/submissions/task/{taskId}": {
      get: {
        tags: ["Submissions"],
        summary: "Entregas de una tarea",
        parameters: [
          { name: "taskId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Array de entregas" } },
      },
    },
    "/api/submissions/student/{studentId}": {
      get: {
        tags: ["Submissions"],
        summary: "Entregas de un estudiante",
        parameters: [
          { name: "studentId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Array de entregas" } },
      },
    },
    "/api/submissions/summary": {
      get: {
        tags: ["Submissions"],
        summary: "Resumen de entregas",
        responses: { "200": { description: "Resumen" } },
      },
    },
    "/api/submissions": {
      post: {
        tags: ["Submissions"],
        summary: "Crear o actualizar entrega (upsert)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["task_id", "content"],
                properties: {
                  task_id: { type: "string" },
                  content: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Entrega creada/actualizada" } },
      },
    },
    "/api/submissions/{id}/grade": {
      put: {
        tags: ["Submissions"],
        summary: "Calificar una entrega",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["grade"],
                properties: { grade: { type: "number" } },
              },
            },
          },
        },
        responses: { "200": { description: "Calificación actualizada" } },
      },
    },

    "/api/courses": {
      get: {
        tags: ["Courses"],
        summary: "Listar todos los cursos",
        responses: { "200": { description: "Array de cursos" } },
      },
      post: {
        tags: ["Courses"],
        summary: "Crear un curso",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["title"],
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  image_url: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Curso creado" } },
      },
    },
    "/api/courses/teacher": {
      get: {
        tags: ["Courses"],
        summary: "Cursos del profesor autenticado",
        responses: { "200": { description: "Array de cursos" } },
      },
    },
    "/api/courses/student/{studentId}": {
      get: {
        tags: ["Courses"],
        summary: "Cursos de un estudiante",
        parameters: [
          { name: "studentId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Array de cursos" } },
      },
    },
    "/api/courses/{id}": {
      get: {
        tags: ["Courses"],
        summary: "Curso individual",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Datos del curso" } },
      },
      put: {
        tags: ["Courses"],
        summary: "Actualizar un curso",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  image_url: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Curso actualizado" } },
      },
      delete: {
        tags: ["Courses"],
        summary: "Eliminar un curso",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Curso eliminado" } },
      },
    },
    "/api/courses/{courseId}/lessons": {
      post: {
        tags: ["Courses"],
        summary: "Agregar lección al curso",
        parameters: [
          { name: "courseId", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["title"],
                properties: {
                  title: { type: "string" },
                  content: { type: "string" },
                  video_url: { type: "string" },
                  order_index: { type: "integer" },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Lección agregada" } },
      },
    },
    "/api/courses/{courseId}/lessons/{lessonId}": {
      put: {
        tags: ["Courses"],
        summary: "Actualizar lección del curso",
        parameters: [
          { name: "courseId", in: "path", required: true, schema: { type: "string" } },
          { name: "lessonId", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  content: { type: "string" },
                  video_url: { type: "string" },
                  order_index: { type: "integer" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Lección actualizada" } },
      },
      delete: {
        tags: ["Courses"],
        summary: "Eliminar lección del curso",
        parameters: [
          { name: "courseId", in: "path", required: true, schema: { type: "string" } },
          { name: "lessonId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Lección eliminada" } },
      },
    },
    "/api/courses/{courseId}/meetings": {
      post: {
        tags: ["Courses"],
        summary: "Agregar reunión al curso",
        parameters: [
          { name: "courseId", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["title"],
                properties: {
                  title: { type: "string" },
                  date: { type: "string" },
                  time: { type: "string" },
                  platform: { type: "string" },
                  link: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Reunión agregada" } },
      },
    },
    "/api/courses/{courseId}/meetings/{meetingId}": {
      delete: {
        tags: ["Courses"],
        summary: "Eliminar reunión del curso",
        parameters: [
          { name: "courseId", in: "path", required: true, schema: { type: "string" } },
          { name: "meetingId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Reunión eliminada" } },
      },
    },
    "/api/courses/{courseId}/enroll": {
      post: {
        tags: ["Courses"],
        summary: "Inscribir al usuario autenticado",
        parameters: [
          { name: "courseId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "201": { description: "Inscrito" } },
      },
    },
    "/api/courses/{courseId}/toggle-block/{studentId}": {
      post: {
        tags: ["Courses"],
        summary: "Activar/desactivar bloqueo de estudiante",
        parameters: [
          { name: "courseId", in: "path", required: true, schema: { type: "string" } },
          { name: "studentId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Estado cambiado" } },
      },
    },

    "/api/progress/{courseId}/{lessonId}": {
      put: {
        tags: ["Progress"],
        summary: "Marcar lección como completada/no completada",
        parameters: [
          { name: "courseId", in: "path", required: true, schema: { type: "string" } },
          { name: "lessonId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Progreso actualizado" } },
      },
    },
    "/api/progress/{courseId}": {
      get: {
        tags: ["Progress"],
        summary: "Progreso del estudiante en un curso",
        parameters: [
          { name: "courseId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Progreso" } },
      },
    },

    "/api/notifications": {
      get: {
        tags: ["Notifications"],
        summary: "Listar notificaciones del usuario",
        responses: { "200": { description: "Array de notificaciones" } },
      },
    },
    "/api/notifications/unread-count": {
      get: {
        tags: ["Notifications"],
        summary: "Conteo de notificaciones no leídas",
        responses: { "200": { description: "Número de no leídas" } },
      },
    },
    "/api/notifications/{id}/read": {
      put: {
        tags: ["Notifications"],
        summary: "Marcar notificación como leída",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Marcada como leída" } },
      },
    },
    "/api/notifications/read-all": {
      put: {
        tags: ["Notifications"],
        summary: "Marcar todas como leídas",
        responses: { "200": { description: "Todas marcadas" } },
      },
    },

    "/api/db/tables": {
      get: {
        tags: ["DB Admin"],
        summary: "Listar tablas de la base de datos",
        responses: { "200": { description: "Lista de tablas" } },
      },
    },
    "/api/db/table/{name}": {
      get: {
        tags: ["DB Admin"],
        summary: "Ver contenido de una tabla (máx 200 filas)",
        parameters: [
          { name: "name", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Filas de la tabla" } },
      },
    },
    "/api/db/query": {
      post: {
        tags: ["DB Admin"],
        summary: "Ejecutar SELECT arbitrario (solo admin)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["sql"],
                properties: { sql: { type: "string" } },
              },
            },
          },
        },
        responses: { "200": { description: "Resultado" } },
      },
    },
  },
}
