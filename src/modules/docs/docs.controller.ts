import { Router } from 'express'
import swaggerUi from 'swagger-ui-express'
import { swaggerSpec } from './swagger.js'

export function createDocsModule(): Router {
  const router = Router()
  router.use('/', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'Trading Academy API Docs',
    customfavIcon: '',
    swaggerOptions: {
      persistAuthorization: true,
    },
  }))
  return router
}
