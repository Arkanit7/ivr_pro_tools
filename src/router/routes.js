import {ROUTES} from './navigation'
import MainLayout from '@/layouts/MainLayout'
import NotFoundPage from '@/pages/NotFoundPage'
// import TypographyPage from '@/pages/TypographyPage'
import TextNormalizerPage from '@/pages/TextNormalizerPage'
import ExcelNormalizerPage from '@/pages/ExcelNormalizerPage'
import ElevenlabsBulkProcessorPage from '@/pages/ElevenlabsBulkProcessorPage'

/** @type {import('react-router').RouteObject[]} */
export default [
  {
    Component: MainLayout,
    children: [
      {
        Component: TextNormalizerPage,
        path: ROUTES.TEXT_NORMALIZER,
        handle: {title: 'Головна'},
      },
      {
        Component: ExcelNormalizerPage,
        path: ROUTES.EXCEL_NORMALIZER,
        handle: {title: 'Головна'},
      },
      {
        Component: ElevenlabsBulkProcessorPage,
        path: ROUTES.ELEVENLABS_BULK_PROCESSOR,
        handle: {title: 'Головна'},
      },
      // {Component: TypographyPage, path: ROUTES.TYPOGRAPHY},
      {Component: NotFoundPage, path: '*'},
    ],
  },
]
