import { SubtitlePipelineUseCase } from '@/domain/use-cases/SubtitlePipelineUseCase';
import { SmartSegmentationUseCase } from '@/domain/use-cases/SmartSegmentationUseCase';
import { StyleManagementUseCase } from '@/domain/use-cases/StyleManagementUseCase';
import { TranslateBatchUseCase } from '@/domain/use-cases/TranslateBatchUseCase';
import { SentenceReconstructor } from '@/domain/services/SentenceReconstructor';
import { TimestampAllocator } from '@/domain/services/TimestampAllocator';
import { LocalAuthGate } from '@/infrastructure/auth/LocalAuthGate';
import { RemoteAuthGate } from '@/infrastructure/auth/RemoteAuthGate';
import { ChromeStorageAdapter } from '@/infrastructure/storage/ChromeStorageAdapter';
import { IndexedDBCacheAdapter } from '@/infrastructure/storage/IndexedDBCacheAdapter';
import { NoopTelemetry } from '@/infrastructure/telemetry/NoopTelemetry';
import { RemoteTelemetry } from '@/infrastructure/telemetry/RemoteTelemetry';
import { GoogleInstantTranslator } from '@/infrastructure/translate/GoogleInstantTranslator';
import { TimedtextFetcher } from '@/infrastructure/youtube/TimedtextFetcher';
import type { BilingualCue } from '@/domain/models/Cue';
import type { IInstantTranslator } from '@/domain/ports/IInstantTranslator';

import type { AppEnv } from './env';

export interface Container {
  pipeline: SubtitlePipelineUseCase;
  styleManagement: StyleManagementUseCase;
  storage: ChromeStorageAdapter;
  cache: IndexedDBCacheAdapter<BilingualCue[]>;
  instantTranslator: IInstantTranslator;
}

export function buildContainer(env: AppEnv): Container {
  const storage = new ChromeStorageAdapter();
  const cache = new IndexedDBCacheAdapter<BilingualCue[]>();
  // LLM provider 不再走容器装配 —— 主流程改用 Google MT；
  // live mode 的 polish 直接在 message-router 用 createProvider() 现拉。
  const instantTranslator = new GoogleInstantTranslator();
  const segmentation = new SmartSegmentationUseCase({
    reconstructor: new SentenceReconstructor(),
  });
  // 主翻译走 Google MT（秒级处理 2000+ 句），AI 润色挪到了 live mode 和侧边栏。
  const translation = new TranslateBatchUseCase({ instantTranslator });
  const telemetry = env === 'cloud' ? new RemoteTelemetry() : new NoopTelemetry();
  const auth = env === 'cloud' ? new RemoteAuthGate() : new LocalAuthGate();

  return {
    pipeline: new SubtitlePipelineUseCase({
      auth,
      cache,
      subtitleSource: new TimedtextFetcher(),
      segmentation,
      translation,
      allocator: new TimestampAllocator(),
      telemetry,
    }),
    styleManagement: new StyleManagementUseCase(storage),
    storage,
    cache,
    instantTranslator,
  };
}
