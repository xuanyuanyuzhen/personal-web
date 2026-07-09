import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSiteSettingsDto {
  @ApiPropertyOptional({ example: '语尔' })
  siteName?: string;

  @ApiPropertyOptional({ example: '轩辕宇振' })
  publicName?: string;

  @ApiPropertyOptional({ example: '安静记录碎片、随笔、照片和一点点日常灵感。' })
  homeIntroduction?: string;

  @ApiPropertyOptional({ example: 'https://github.com/example' })
  githubUrl?: string;

  @ApiPropertyOptional({ example: '/uploads/site/avatar/avatar.png' })
  avatarUrl?: string;

  @ApiPropertyOptional({ example: '/favicon.ico' })
  faviconUrl?: string;

  @ApiPropertyOptional({ example: '<p>你好，我是语尔。</p>' })
  aboutContent?: string;
}

export class UpdateAnnouncementDto {
  @ApiPropertyOptional({ example: '欢迎来到语尔' })
  title?: string;

  @ApiPropertyOptional({ example: '<p>这里会安静收纳碎片、随笔、照片和留言。</p>' })
  content?: string;

  @ApiPropertyOptional({ example: true })
  isEnabled?: boolean;
}
