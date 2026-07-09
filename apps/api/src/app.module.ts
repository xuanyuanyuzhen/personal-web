import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { EssayModule } from './essays/essay.module';
import { HealthModule } from './health/health.module';
import { LikeModule } from './likes/like.module';
import { MascotModule } from './mascot/mascot.module';
import { MessageModule } from './messages/message.module';
import { MusicModule } from './music/music.module';
import { NavigationModule } from './navigations/navigation.module';
import { OperationLogModule } from './operation-log/operation-log.module';
import { PageModule } from './pages/page.module';
import { PhotoModule } from './photos/photo.module';
import { PrismaModule } from './prisma/prisma.module';
import { RecycleBinModule } from './recycle-bin/recycle-bin.module';
import { SearchModule } from './search/search.module';
import { SettingsModule } from './settings/settings.module';
import { StatisticModule } from './statistics/statistic.module';
import { TagModule } from './tags/tag.module';
import { ThoughtModule } from './thoughts/thought.module';
import { UploadModule } from './uploads/upload.module';

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    OperationLogModule,
    LikeModule,
    MascotModule,
    MusicModule,
    AuthModule,
    MessageModule,
    NavigationModule,
    PageModule,
    PhotoModule,
    RecycleBinModule,
    SearchModule,
    SettingsModule,
    StatisticModule,
    ThoughtModule,
    EssayModule,
    TagModule,
    UploadModule,
  ],
})
export class AppModule {}
