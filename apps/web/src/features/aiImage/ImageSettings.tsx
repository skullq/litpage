// AI image generation settings: workspace switch, image model routing, and live connection test.
// Settings › Litpage AI › Image generation
import { useState } from 'react';
import type { SpaceRecord } from '@nc/shared/records.ts';
import { api } from '../../lib/api.ts';
import { Icon } from '../../components/Icon.tsx';
import { Badge, Button, Dropdown, Group, Row, Switch } from '../settings/ui.tsx';
import { saveSpaceSettings, spaceSetting, useSpaceAccess } from '../settings/spaceSettings.ts';
import { useAiStatus } from '../ai/aiApi.ts';
import { t } from '../shell/i18n.ts';

export function ImageGenerationSettings() {
  const { space, owner: admin } = useSpaceAccess();
  if (!space) return null;
  return <ImageGroup space={space} admin={admin} />;
}

interface TestResult {
  ok: boolean;
  model?: string;
  durationMs?: number;
  url?: string;
  width?: number;
  height?: number;
  error?: string;
}

function ImageGroup({ space, admin }: { space: SpaceRecord; admin: boolean }) {
  const aiStatus = useAiStatus();
  const aiOn = spaceSetting<boolean>(space, 'ai_enabled', true) !== false;
  const on = spaceSetting<boolean>(space, 'ai_image_generation', true) !== false;
  const imageModel = spaceSetting<string>(space, 'ai_image_model', '');
  const [customModel, setCustomModel] = useState('');
  const [isCustom, setIsCustom] = useState(() => !!imageModel && !aiStatus.models.some((m) => m.id === imageModel));
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const tip = !aiOn
    ? t('lp.aiimage.turn_on_litpage_ai_before_generating', 'Turn on Litpage AI before generating images.')
    : !admin ? t('lp.aiimage.to_change_this_reach_out_to', 'To change this, reach out to your workspace admin') : undefined;

  const defaultLabel = aiStatus.autoModel || aiStatus.modelLabel || '기본 AI 모델';
  const modelOptions = [
    { value: '', label: `기본 AI 모델 (${defaultLabel})`, description: '문서/채팅과 동일한 기본 LLM을 사용하여 이미지를 생성합니다' },
    ...aiStatus.models.map((m) => ({
      value: m.id,
      label: `${m.name} ${m.version}`.trim(),
      description: m.description,
    })),
    { value: '__custom__', label: '직접 입력 (Custom model)...', description: '원하는 이미지 생성/추론 모델명을 직접 입력합니다' },
  ];

  const currentDropdownValue = isCustom ? '__custom__' : imageModel;

  const handleModelChange = (val: string) => {
    if (val === '__custom__') {
      setIsCustom(true);
      return;
    }
    setIsCustom(false);
    saveSpaceSettings(space.id, { ai_image_model: val });
  };

  const handleCustomBlur = () => {
    const trimmed = customModel.trim();
    saveSpaceSettings(space.id, { ai_image_model: trimmed });
  };

  const runConnectionTest = async () => {
    if (testing) return;
    setTesting(true);
    setTestResult(null);
    try {
      const activeModel = isCustom ? customModel.trim() : imageModel;
      const res = await api<TestResult>('aiTestImageModel', {
        spaceId: space.id,
        model: activeModel || undefined,
      });
      setTestResult(res);
    } catch (e: any) {
      setTestResult({
        ok: false,
        error: e?.message || '연결 테스트 중 오류가 발생했습니다.',
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Group plain title={t('lp.aiimage.image_generation', 'Image generation')}>
      <Row
        id="ai-image-generation"
        label={t('lp.aiimage.turn_on_image_generation', 'Turn on image generation')}
        description={t('lp.aiimage.let_people_in_this_workspace_create', 'Let people in this workspace create images with AI')}
        control={(
          <span data-tooltip={tip}>
            <Switch
              label="Turn on image creation"
              checked={aiOn && on}
              disabled={!admin || !aiOn}
              onChange={(v) => saveSpaceSettings(space.id, { ai_image_generation: v })}
            />
          </span>
        )}
      />

      {on && aiOn && (
        <>
          <Row
            id="ai-image-model"
            label="이미지 생성 전용 LLM 모델"
            description="이미지 및 SVG 일러스트 생성 시 사용할 모델을 선택합니다. 일반 텍스트 모델과 분리하여 그래픽 추론 모델을 지정할 수 있습니다."
            control={(
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                <Dropdown
                  disabled={!admin}
                  width={280}
                  value={currentDropdownValue}
                  options={modelOptions}
                  onChange={handleModelChange}
                />
                {isCustom && (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                      style={{
                        padding: '4px 8px',
                        fontSize: 13,
                        borderRadius: 4,
                        border: '1px solid var(--lp-border-subtle)',
                        width: 200,
                      }}
                      placeholder="모델명 (예: gemini-2.5-flash)"
                      defaultValue={imageModel}
                      onChange={(e) => setCustomModel(e.target.value)}
                      onBlur={handleCustomBlur}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCustomBlur();
                      }}
                    />
                    <Button small disabled={!admin} onClick={handleCustomBlur}>저장</Button>
                  </div>
                )}
              </div>
            )}
          />

          <Row
            id="ai-image-test"
            label="이미지 생성 LLM 연결 테스트"
            description="현재 설정된 LLM으로 실제 SVG 일러스트 생성을 테스트하여 연결 상태, 응답 속도(Latency), 결과물을 확인합니다."
            control={(
              <Button
                icon={testing ? undefined : 'sparkle'}
                disabled={testing || !admin}
                onClick={runConnectionTest}
              >
                {testing ? '연결 테스트 중...' : '연결 테스트 실행'}
              </Button>
            )}
          />

          {testing && (
            <div style={{ padding: '10px 14px', background: 'var(--lp-tint-blue, rgba(9, 105, 218, 0.06))', borderRadius: 6, fontSize: 13, color: 'var(--lp-text-secondary)' }}>
              <span>이미지 생성 LLM에 테스트 요청을 전송했습니다. 응답을 대기하고 있습니다... (약 2~5초 소요)</span>
            </div>
          )}

          {testResult && !testing && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 6,
                border: `1px solid ${testResult.ok ? 'var(--lp-border-green, #2ea043)' : 'var(--lp-border-red, #da3633)'}`,
                background: testResult.ok ? 'var(--lp-tint-green, rgba(46, 160, 67, 0.08))' : 'var(--lp-tint-red, rgba(218, 54, 51, 0.08))',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, color: testResult.ok ? 'var(--lp-green, #2ea043)' : 'var(--lp-red, #da3633)' }}>
                <Icon name={testResult.ok ? 'check' : 'warning'} size={16} />
                <span>{testResult.ok ? '이미지 생성 LLM 정상 연결됨' : '이미지 생성 LLM 연결 실패'}</span>
                {testResult.durationMs != null && (
                  <Badge tone={testResult.ok ? 'blue' : 'gray'}>
                    응답 속도: {(testResult.durationMs / 1000).toFixed(1)}초
                  </Badge>
                )}
                {testResult.model && (
                  <Badge tone="gray">
                    모델: {testResult.model}
                  </Badge>
                )}
              </div>

              {testResult.ok ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10 }}>
                  {testResult.url && (
                    <img
                      src={testResult.url}
                      alt="테스트 SVG"
                      style={{
                        width: 80,
                        height: 60,
                        objectFit: 'contain',
                        background: '#ffffff',
                        border: '1px solid var(--lp-border-subtle)',
                        borderRadius: 4,
                      }}
                    />
                  )}
                  <div style={{ fontSize: 13, color: 'var(--lp-text-secondary)', lineHeight: 1.5 }}>
                    SVG 일러스트가 성공적으로 생성 및 저장되었습니다. AI 이미지 생성 기능이 정상 동작합니다.
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: 8, fontSize: 13, color: 'var(--lp-text-primary)', lineHeight: 1.5 }}>
                  <div><b>오류 내용:</b> {testResult.error}</div>
                  <div style={{ marginTop: 4, fontSize: 12, color: 'var(--lp-text-secondary)' }}>
                    설정된 LLM 모델 이름이 올바른지, API 키 또는 엔드포인트 권한을 확인해주세요.
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </Group>
  );
}
