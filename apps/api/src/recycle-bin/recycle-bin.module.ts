import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OperationLogModule } from '../operation-log/operation-log.module';
import { RecycleBinController } from './recycle-bin.controller';
import { RecycleBinService } from './recycle-bin.service';

@Module({
  controllers: [RecycleBinController],
  imports: [AuthModule, OperationLogModule],
  providers: [RecycleBinService],
})
export class RecycleBinModule {}
