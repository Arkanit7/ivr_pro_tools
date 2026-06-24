import {FileText, FileSpreadsheet, FileAudio, AudioWaveform} from 'lucide-react'

export const ROUTES = {
  HOME: '',
  TEXT_NORMALIZER: 'text-normalizer',
  EXCEL_NORMALIZER: 'excel-normalizer',
  ELEVENLABS_BULK_PROCESSOR: 'excel-to-voice',
  AUDIO_EDITOR: 'audio-editor',
}

export const navigationRoutes = {
  home: '/',
  textNormalizer: `/${ROUTES.TEXT_NORMALIZER}`,
  excelNormalizer: `/${ROUTES.EXCEL_NORMALIZER}`,
  elevenlabsBulkProcessor: `/${ROUTES.ELEVENLABS_BULK_PROCESSOR}`,
  audioEditor: `/${ROUTES.AUDIO_EDITOR}`,
}

export const navItems = [
  {to: navigationRoutes.textNormalizer, icon: FileText, label: 'Нормалізатор тексту'},
  {to: navigationRoutes.excelNormalizer, icon: FileSpreadsheet, label: 'Нормалізатор Excel'},
  {to: navigationRoutes.elevenlabsBulkProcessor, icon: FileAudio, label: 'Excel у голос'},
  {to: navigationRoutes.audioEditor, icon: AudioWaveform, label: 'Аудіоредактор'},
]
