import {Button} from '@/components/ui/button'
import {Label} from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import VoiceSettings from '@/components/ElevenLabsSettings/VoiceSettings'
import TextNormalizationSelect from '@/components/ElevenLabsSettings/TextNormalizationSelect'
import {useElevenLabsSettings} from '@/context/ElevenLabsSettingsContext'
import {MODELS, SAVE_FORMATS} from '@/lib/elevenlabsModels'

// Settings are shared by every ElevenLabs page through ElevenLabsSettingsContext.
export default function ElevenLabsSettingsPanel() {
  const {settings, updateSettings, resetSettings} = useElevenLabsSettings()
  const set = (key) => (value) => updateSettings({[key]: value})

  return (
    <>
      {/* Model */}
      <div className="flex flex-col gap-3 p-1.5">
        <Label>Модель</Label>
        <Select value={settings.model} onValueChange={set('model')}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODELS.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Voice sliders */}
      <VoiceSettings
        model={settings.model}
        speed={settings.speed}
        setSpeed={set('speed')}
        stability={settings.stability}
        setStability={set('stability')}
        similarityBoost={settings.similarityBoost}
        setSimilarityBoost={set('similarityBoost')}
        styleExaggeration={settings.style}
        setStyleExaggeration={set('style')}
      />

      {/* Text normalization */}
      <TextNormalizationSelect
        applyTextNormalization={settings.textNormalization}
        setApplyTextNormalization={set('textNormalization')}
      />

      {/* Save format */}
      <div className="flex flex-col gap-3 p-1.5">
        <Label>Зберегти як</Label>
        <Select value={settings.saveFormat} onValueChange={set('saveFormat')}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SAVE_FORMATS.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button variant="ghost" onClick={resetSettings} className="w-full">
        Скинути до стандартних
      </Button>
    </>
  )
}
