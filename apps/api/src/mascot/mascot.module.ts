import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OperationLogModule } from '../operation-log/operation-log.module';
import { MascotController } from './mascot.controller';
import { MascotService } from './mascot.service';

@Module({
  controllers: [MascotController],
  imports: [AuthModule, OperationLogModule],
  providers: [MascotService],
})
export class MascotModule {}
