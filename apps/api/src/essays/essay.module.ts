import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OperationLogModule } from '../operation-log/operation-log.module';
import { EssayController } from './essay.controller';
import { EssayService } from './essay.service';

@Module({
  imports: [AuthModule, OperationLogModule],
  controllers: [EssayController],
  providers: [EssayService],
  exports: [EssayService],
})
export class EssayModule {}
