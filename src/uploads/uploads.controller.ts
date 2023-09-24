import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as AWS from 'aws-sdk';

const BUCKET_NAME = 'nuber-eats';

@Controller('uploads')
export class UploadsController {
  @Post('')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file) {
    try {
      AWS.config.update({
        credentials: {
          accessKeyId: process.env.AWS_KEY,
          secretAccessKey: process.env.AWS_SECRET,
        },
      });
      if (!file) {
        return {
          ok: false,
        };
      }
      const objectNmae = `${Date.now() + file.originalname}`;
      await new AWS.S3()
        .putObject({
          Body: file.buffer,
          Bucket: BUCKET_NAME,
          Key: objectNmae,
          ACL: 'public-read',
        })
        .promise();
      const url = `https://${BUCKET_NAME}.s3.ap-northeast-2.amazonaws.com/${objectNmae}`;
      return {
        url,
      };
    } catch (error) {
      console.log(error);
      return {
        ok: false,
      };
    }
  }
}
