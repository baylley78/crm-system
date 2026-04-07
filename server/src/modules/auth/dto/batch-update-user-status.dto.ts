import { Type } from 'class-transformer'
import { ArrayNotEmpty, IsArray, IsEnum, IsInt } from 'class-validator'
import { UserStatusDto } from './create-user.dto'

export class BatchUpdateUserStatusDto {
  @IsArray()
  @ArrayNotEmpty({ message: '请选择至少一个用户' })
  @IsInt({ each: true, message: '用户ID格式不正确' })
  @Type(() => Number)
  userIds: number[]

  @IsEnum(UserStatusDto)
  status: UserStatusDto
}
