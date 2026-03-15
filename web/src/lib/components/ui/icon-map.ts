import type { ComponentType } from 'svelte';
import {
  IconBulb,
  IconChartBar,
  IconCloud,
  IconCloudDown,
  IconCloudRain,
  IconCloudUp,
  IconCurrencyDollar,
  IconDroplet,
  IconEye,
  IconFlask2,
  IconNavigation,
  IconRuler2,
  IconSettings,
  IconSparkles,
  IconSun,
  IconSunrise,
  IconSunset2,
  IconTemperature,
  IconTemperatureSun,
  IconTimeline,
  IconTool,
  IconUser,
  IconUvIndex,
  IconVaccineBottle,
  IconWind,
} from '@tabler/icons-svelte';

export type IconName =
  | 'poolSummary'
  | 'recommendations'
  | 'dosingHistory'
  | 'costs'
  | 'weatherQuality'
  | 'maintenance'
  | 'aiAdvisor'
  | 'weatherUv'
  | 'weatherRain'
  | 'weatherWind'
  | 'weatherHumidity'
  | 'weatherSunrise'
  | 'weatherSunset'
  | 'poolOwner'
  | 'poolVolume'
  | 'poolSurface'
  | 'poolSanitizer'
  | 'poolEquipment'
  | 'poolLastTested'
  | 'weatherVisibility'
  | 'weatherCloudCover'
  | 'weatherCloudBase'
  | 'weatherCloudCeiling'
  | 'weatherUvConcern'
  | 'weatherApparentTemp'
  | 'weatherHeatStress'
  | 'weatherWindDirection'
  | 'weatherWindGust'
  | 'weatherWindForce';

export const iconMap: Record<IconName, ComponentType> = {
  poolSummary: IconChartBar,
  recommendations: IconBulb,
  dosingHistory: IconTimeline,
  costs: IconCurrencyDollar,
  weatherQuality: IconCloud,
  maintenance: IconTool,
  aiAdvisor: IconSparkles,
  weatherUv: IconUvIndex,
  weatherRain: IconCloudRain,
  weatherWind: IconWind,
  weatherHumidity: IconDroplet,
  weatherSunrise: IconSunrise,
  weatherSunset: IconSunset2,
  poolOwner: IconUser,
  poolVolume: IconDroplet,
  poolSurface: IconRuler2,
  poolSanitizer: IconFlask2,
  poolEquipment: IconSettings,
  poolLastTested: IconVaccineBottle,
  weatherVisibility: IconEye,
  weatherCloudCover: IconCloud,
  weatherCloudBase: IconCloudDown,
  weatherCloudCeiling: IconCloudUp,
  weatherUvConcern: IconSun,
  weatherApparentTemp: IconTemperature,
  weatherHeatStress: IconTemperatureSun,
  weatherWindDirection: IconNavigation,
  weatherWindGust: IconWind,
  weatherWindForce: IconWind,
};

export const iconLabelMap: Record<IconName, string> = {
  poolSummary: 'Pool summary',
  recommendations: 'Recommendations',
  dosingHistory: 'Dosing history',
  costs: 'Costs',
  weatherQuality: 'Weather quality',
  maintenance: 'Maintenance',
  aiAdvisor: 'AI advisor',
  weatherUv: 'UV',
  weatherRain: 'Rain',
  weatherWind: 'Wind',
  weatherHumidity: 'Humidity',
  weatherSunrise: 'Sunrise',
  weatherSunset: 'Sunset',
  poolOwner: 'Pool owner',
  poolVolume: 'Pool volume',
  poolSurface: 'Pool surface',
  poolSanitizer: 'Pool sanitizer',
  poolEquipment: 'Pool equipment',
  poolLastTested: 'Last tested',
  weatherVisibility: 'Visibility',
  weatherCloudCover: 'Cloud cover',
  weatherCloudBase: 'Cloud base',
  weatherCloudCeiling: 'Cloud ceiling',
  weatherUvConcern: 'UV concern',
  weatherApparentTemp: 'Apparent temperature',
  weatherHeatStress: 'Heat stress',
  weatherWindDirection: 'Wind direction',
  weatherWindGust: 'Wind gust',
  weatherWindForce: 'Wind force',
};
