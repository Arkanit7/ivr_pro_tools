import {ROUTES} from './navigation'
import MainLayout from '@/layouts/MainLayout'
import NotFoundPage from '@/pages/NotFoundPage'
import HomePage from '@/pages/HomePage'
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
        index: true,
        Component: HomePage,
        handle: {title: 'Home'},
      },
      {
        Component: TextNormalizerPage,
        path: ROUTES.TEXT_NORMALIZER,
        handle: {title: 'Text Normalizer', icon: 'FileText'},
      },
      {
        Component: ExcelNormalizerPage,
        path: ROUTES.EXCEL_NORMALIZER,
        handle: {title: 'Excel Normalizer', icon: 'FileSpreadsheet'},
      },
      {
        Component: ElevenlabsBulkProcessorPage,
        path: ROUTES.ELEVENLABS_BULK_PROCESSOR,
        handle: {title: 'Excel to Voice', icon: 'FileAudio'},
      },
      // {Component: TypographyPage, path: ROUTES.TYPOGRAPHY},
      {Component: NotFoundPage, path: '*'},
    ],
  },
]
