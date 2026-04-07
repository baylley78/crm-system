import { Type } from 'class-transformer'
import { IsBoolean, IsDateString, IsNotEmpty, IsNumber, IsOptional, IsPhoneNumber, IsString, Min } from 'class-validator'

export class CreateJudicialComplaintDto {
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  customerId?: number

  @IsString()
  @IsNotEmpty()
  complaintSubject: string

  @IsOptional()
  @IsString()
  teamName?: string

  @IsOptional()
  @IsString()
  departmentName?: string

  @IsDateString()
  complaintTime: string

  @IsString()
  @IsNotEmpty()
  customerName: string

  @IsPhoneNumber('CN')
  phone: string

  @IsOptional()
  @IsString()
  relationToCustomer?: string

  @IsOptional()
  @IsDateString()
  firstSignTime?: string

  @IsOptional()
  @IsDateString()
  secondSignTime?: string

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  firstDealAmount?: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  secondDealAmount?: number

  @IsOptional()
  @IsString()
  firstSalesName?: string

  @IsOptional()
  @IsString()
  secondSalesName?: string

  @IsOptional()
  @IsString()
  legalAssistantName?: string

  @IsOptional()
  @IsString()
  summary?: string

  @IsString()
  @IsNotEmpty()
  complaintReason: string

  @IsOptional()
  @IsString()
  progress?: string

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  refundAmount?: number

  @Type(() => Boolean)
  @IsBoolean()
  intervenedBeforeComplaint: boolean

  @Type(() => Boolean)
  @IsBoolean()
  suddenRefundRequest: boolean

  @Type(() => Boolean)
  @IsBoolean()
  thirdPartyGuidance: boolean

  @Type(() => Boolean)
  @IsBoolean()
  shouldHandle: boolean
}
