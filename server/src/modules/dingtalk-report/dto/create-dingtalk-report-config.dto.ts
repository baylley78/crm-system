import { Type } from 'class-transformer'
import { ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator'

export class CreateDingTalkReportConfigDto {
  @IsString()
  @IsIn(['FIRST_SALES', 'LITIGATION'])
  templateType: 'FIRST_SALES' | 'LITIGATION'

  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Type(() => Number)
  departmentIds: number[]

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  departmentNames: string[]

  @IsString()
  @IsUrl({ require_tld: false }, { message: 'Webhook 地址格式不正确' })
  webhookUrl: string

  @IsOptional()
  @IsString()
  dailyTarget?: string

  @IsString()
  @IsNotEmpty()
  messageTemplate: string

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean
}
