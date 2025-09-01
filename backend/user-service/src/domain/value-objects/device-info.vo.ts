import { IsString, IsOptional, MaxLength, IsEnum } from 'class-validator';

export enum DeviceType {
  DESKTOP = 'desktop',
  MOBILE = 'mobile',
  TABLET = 'tablet',
  UNKNOWN = 'unknown',
}

export enum OperatingSystem {
  WINDOWS = 'windows',
  MACOS = 'macos',
  LINUX = 'linux',
  IOS = 'ios',
  ANDROID = 'android',
  UNKNOWN = 'unknown',
}

export class DeviceInfo {
  @IsEnum(DeviceType)
  readonly type: DeviceType;

  @IsEnum(OperatingSystem)
  readonly os: OperatingSystem;

  @IsString()
  @MaxLength(100)
  readonly browser: string;

  @IsString()
  @MaxLength(50)
  readonly browserVersion: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  readonly deviceName?: string;

  constructor(type: DeviceType, os: OperatingSystem, browser: string, browserVersion: string, deviceName?: string) {
    this.type = type;
    this.os = os;
    this.browser = browser;
    this.browserVersion = browserVersion;
    this.deviceName = deviceName;
  }

  /**
   * Создает DeviceInfo из User-Agent строки
   */
  static fromUserAgent(userAgent: string): DeviceInfo {
    const type = this.detectDeviceType(userAgent);
    const os = this.detectOperatingSystem(userAgent);
    const { browser, version } = this.detectBrowser(userAgent);

    return new DeviceInfo(type, os, browser, version);
  }

  /**
   * Определяет тип устройства по User-Agent
   */
  private static detectDeviceType(userAgent: string): DeviceType {
    const ua = userAgent.toLowerCase();

    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      return DeviceType.MOBILE;
    }

    if (ua.includes('tablet') || ua.includes('ipad')) {
      return DeviceType.TABLET;
    }

    if (ua.includes('windows') || ua.includes('macintosh') || ua.includes('linux')) {
      return DeviceType.DESKTOP;
    }

    return DeviceType.UNKNOWN;
  }

  /**
   * Определяет операционную систему по User-Agent
   */
  private static detectOperatingSystem(userAgent: string): OperatingSystem {
    const ua = userAgent.toLowerCase();

    if (ua.includes('windows')) return OperatingSystem.WINDOWS;
    if (ua.includes('macintosh') || ua.includes('mac os')) return OperatingSystem.MACOS;
    if (ua.includes('linux')) return OperatingSystem.LINUX;
    if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ios')) return OperatingSystem.IOS;
    if (ua.includes('android')) return OperatingSystem.ANDROID;

    return OperatingSystem.UNKNOWN;
  }

  /**
   * Определяет браузер и версию по User-Agent
   */
  private static detectBrowser(userAgent: string): { browser: string; version: string } {
    const ua = userAgent.toLowerCase();

    // Chrome
    if (ua.includes('chrome') && !ua.includes('edg')) {
      const match = ua.match(/chrome\/(\d+\.\d+)/);
      return { browser: 'Chrome', version: match ? match[1] : 'unknown' };
    }

    // Firefox
    if (ua.includes('firefox')) {
      const match = ua.match(/firefox\/(\d+\.\d+)/);
      return { browser: 'Firefox', version: match ? match[1] : 'unknown' };
    }

    // Safari
    if (ua.includes('safari') && !ua.includes('chrome')) {
      const match = ua.match(/version\/(\d+\.\d+)/);
      return { browser: 'Safari', version: match ? match[1] : 'unknown' };
    }

    // Edge
    if (ua.includes('edg')) {
      const match = ua.match(/edg\/(\d+\.\d+)/);
      return { browser: 'Edge', version: match ? match[1] : 'unknown' };
    }

    return { browser: 'Unknown', version: 'unknown' };
  }

  /**
   * Возвращает читаемое описание устройства
   */
  getDisplayName(): string {
    const parts = [this.browser];

    if (this.browserVersion !== 'unknown') {
      parts.push(this.browserVersion);
    }

    parts.push(`on ${this.os}`);

    if (this.deviceName) {
      parts.push(`(${this.deviceName})`);
    }

    return parts.join(' ');
  }

  /**
   * Проверяет равенство с другим DeviceInfo
   */
  equals(other: DeviceInfo): boolean {
    return (
      this.type === other.type &&
      this.os === other.os &&
      this.browser === other.browser &&
      this.browserVersion === other.browserVersion &&
      this.deviceName === other.deviceName
    );
  }
}
