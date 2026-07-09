# 上传服务

目标：实现统一上传服务，支持图片、音乐、歌词和站点资源。
- [x] 实现上传目录环境变量。
- [x] 实现文件 URL 和物理路径分离保存。
- [x] 实现图片格式校验：jpg、jpeg、png、webp、gif。
- [x] 实现图片单文件 10MB 限制。
- [x] 实现音乐格式校验：mp3、wav、ogg、flac。
- [x] 实现音乐单文件 20MB 限制。
- [x] 实现歌词格式校验：lrc、txt。
- [x] 实现看板娘图片格式校验。
- [x] 看板娘图片不限制文件大小。
- [x] 实现照片原图保存到 `uploads/photos/original/{yyyy}/{mm}`。
- [x] 实现照片压缩大图生成到 `uploads/photos/large/{yyyy}/{mm}`。
- [x] 实现照片缩略图生成到 `uploads/photos/thumb/{yyyy}/{mm}`。
- [x] 实现音乐文件保存到 `uploads/music`。
- [x] 实现头像上传到 `uploads/site/avatar`。
- [x] 实现看板娘图片上传到 `uploads/site/mascot`。
- [x] 实现公告图片上传到 `uploads/site/announcement`。
- [x] 实现后台上传接口。
- [x] 后台上传接口需要鉴权。
- [x] 返回文件元数据给业务模块。
- [x] 为上传限制编写后端测试。
验收标准：
- [x] 非允许格式会被拒绝。
- [x] 超出大小限制会被拒绝。
- [x] 照片上传后可得到原图、大图、缩略图元数据。
