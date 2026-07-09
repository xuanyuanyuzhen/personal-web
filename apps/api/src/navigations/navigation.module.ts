import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OperationLogModule } from '../operation-log/operation-log.module';
import { NavigationController } from './navigation.controller';
import { NavigationService } from './navigation.service';

@Module({
  imports: [AuthModule, OperationLogModule],
  controllers: [NavigationController],
  providers: [NavigationService],
  exports: [NavigationService],
})
export class NavigationModule {}
