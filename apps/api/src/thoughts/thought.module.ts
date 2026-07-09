import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OperationLogModule } from '../operation-log/operation-log.module';
import { ThoughtController } from './thought.controller';
import { ThoughtService } from './thought.service';

@Module({
  imports: [AuthModule, OperationLogModule],
  controllers: [ThoughtController],
  providers: [ThoughtService],
  exports: [ThoughtService],
})
export class ThoughtModule {}
