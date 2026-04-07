import { PartialType } from '@nestjs/swagger'
import { CreateDingTalkReportConfigDto } from './create-dingtalk-report-config.dto'

export class UpdateDingTalkReportConfigDto extends PartialType(CreateDingTalkReportConfigDto) {}
