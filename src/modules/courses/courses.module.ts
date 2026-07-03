import { Router } from 'express'
import { CoursesService } from './courses.service.js'
import { CoursesController } from './courses.controller.js'
import { requireAuth } from '../../common/guards/auth.guard.js'
import { requireTeacher } from '../../common/guards/roles.guard.js'

export function createCoursesModule(): Router {
  const service = new CoursesService()
  const controller = new CoursesController(service)
  const router = Router()

  router.get('/', requireAuth, controller.getAll)
  router.get('/teacher', requireAuth, controller.getByTeacher)
  router.get('/student/:studentId', requireAuth, controller.getByStudent)
  router.get('/:id', requireAuth, controller.getById)
  router.post('/', requireAuth, requireTeacher, controller.create)
  router.put('/:id', requireAuth, requireTeacher, controller.update)
  router.delete('/:id', requireAuth, requireTeacher, controller.delete)

  router.post('/:courseId/lessons', requireAuth, requireTeacher, controller.addLesson)
  router.put('/:courseId/lessons/:lessonId', requireAuth, requireTeacher, controller.updateLesson)
  router.delete('/:courseId/lessons/:lessonId', requireAuth, requireTeacher, controller.removeLesson)

  router.post('/:courseId/meetings', requireAuth, requireTeacher, controller.addMeeting)
  router.delete('/:courseId/meetings/:meetingId', requireAuth, requireTeacher, controller.removeMeeting)

  router.post('/:courseId/enroll', requireAuth, controller.enroll)
  router.post('/:courseId/toggle-block/:studentId', requireAuth, requireTeacher, controller.toggleBlock)

  return router
}
