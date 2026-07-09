import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StatisticController } from './statistic.controller';
import { StatisticService } from './statistic.service';

@Module({
  controllers: [StatisticController],
  imports: [AuthModule],
  providers: [StatisticService],
})
export class StatisticModule {}
