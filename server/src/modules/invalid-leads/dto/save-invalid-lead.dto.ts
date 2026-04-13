import { Transform } from 'class-transformer'
import { IsDateString, IsNotEmpty, Matches } from 'class-validator'

export class SaveInvalidLeadDto {
  @IsDateString()
  @IsNotEmpty()
  reportDate: string

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty()
  @Matches(/^1\d{10}$/, { message: '请输入正确的11位手机号' })
  phone: string
}
