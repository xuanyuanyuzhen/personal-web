import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OperationLogModule } from '../operation-log/operation-log.module';
import { TagController } from './tag.controller';
import { TagService } from './tag.service';

@Module({
  imports: [AuthModule, OperationLogModule],
  controllers: [TagController],
  providers: [TagService],
  exports: [TagService],
})
export class TagModule {}
