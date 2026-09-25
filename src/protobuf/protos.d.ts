import * as $protobuf from "protobufjs";
import Long = require("long");

/** Namespace checkin_proto. */
export namespace checkin_proto {

    /**
     * Properties of a ChromeBuildProto.
     * @deprecated Use checkin_proto.ChromeBuildProto.$Properties instead.
     */
    interface IChromeBuildProto extends checkin_proto.ChromeBuildProto.$Properties {
    }

    /** Represents a ChromeBuildProto. */
    class ChromeBuildProto {

        /**
         * Constructs a new ChromeBuildProto.
         * @param [properties] Properties to set
         */
        constructor(properties?: checkin_proto.ChromeBuildProto.$Properties);

        /** Unknown fields preserved while decoding when enabled */
        $unknowns?: Uint8Array[];

        /** ChromeBuildProto platform. */
        platform: checkin_proto.ChromeBuildProto.Platform;

        /** ChromeBuildProto chromeVersion. */
        chromeVersion: string;

        /** ChromeBuildProto channel. */
        channel: checkin_proto.ChromeBuildProto.Channel;

        /**
         * Creates a new ChromeBuildProto instance using the specified properties.
         * @param [properties] Properties to set
         * @returns ChromeBuildProto instance
         */
        static create(properties: checkin_proto.ChromeBuildProto.$Shape): checkin_proto.ChromeBuildProto & checkin_proto.ChromeBuildProto.$Shape;
        static create(properties?: checkin_proto.ChromeBuildProto.$Properties): checkin_proto.ChromeBuildProto;

        /**
         * Encodes the specified ChromeBuildProto message. Does not implicitly {@link checkin_proto.ChromeBuildProto.verify|verify} messages.
         * @param message ChromeBuildProto message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        static encode(message: checkin_proto.ChromeBuildProto.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified ChromeBuildProto message, length delimited. Does not implicitly {@link checkin_proto.ChromeBuildProto.verify|verify} messages.
         * @param message ChromeBuildProto message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        static encodeDelimited(message: checkin_proto.ChromeBuildProto.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a ChromeBuildProto message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns {checkin_proto.ChromeBuildProto & checkin_proto.ChromeBuildProto.$Shape} ChromeBuildProto
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): checkin_proto.ChromeBuildProto & checkin_proto.ChromeBuildProto.$Shape;

        /**
         * Decodes a ChromeBuildProto message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns {checkin_proto.ChromeBuildProto & checkin_proto.ChromeBuildProto.$Shape} ChromeBuildProto
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): checkin_proto.ChromeBuildProto & checkin_proto.ChromeBuildProto.$Shape;

        /**
         * Verifies a ChromeBuildProto message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a ChromeBuildProto message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns ChromeBuildProto
         */
        static fromObject(object: { [k: string]: any }): checkin_proto.ChromeBuildProto;

        /**
         * Creates a plain object from a ChromeBuildProto message. Also converts values to other types if specified.
         * @param message ChromeBuildProto
         * @param [options] Conversion options
         * @returns Plain object
         */
        static toObject(message: checkin_proto.ChromeBuildProto, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this ChromeBuildProto to JSON.
         * @returns JSON object
         */
        toJSON(): { [k: string]: any };

        /**
         * Gets the type url for ChromeBuildProto
         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
         * @returns The type url
         */
        static getTypeUrl(prefix?: string): string;
    }

    namespace ChromeBuildProto {

        /** Properties of a ChromeBuildProto. */
        interface $Properties {

            /** ChromeBuildProto platform */
            platform?: (checkin_proto.ChromeBuildProto.Platform|null);

            /** ChromeBuildProto chromeVersion */
            chromeVersion?: (string|null);

            /** ChromeBuildProto channel */
            channel?: (checkin_proto.ChromeBuildProto.Channel|null);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];
        }

        /** Shape of a ChromeBuildProto. */
        type $Shape = checkin_proto.ChromeBuildProto.$Properties;

        /** Platform enum. */
        enum Platform {

            /** PLATFORM_WIN value */
            PLATFORM_WIN = 1,

            /** PLATFORM_MAC value */
            PLATFORM_MAC = 2,

            /** PLATFORM_LINUX value */
            PLATFORM_LINUX = 3,

            /** PLATFORM_CROS value */
            PLATFORM_CROS = 4,

            /** PLATFORM_IOS value */
            PLATFORM_IOS = 5,

            /** PLATFORM_ANDROID value */
            PLATFORM_ANDROID = 6
        }

        /** Channel enum. */
        enum Channel {

            /** CHANNEL_STABLE value */
            CHANNEL_STABLE = 1,

            /** CHANNEL_BETA value */
            CHANNEL_BETA = 2,

            /** CHANNEL_DEV value */
            CHANNEL_DEV = 3,

            /** CHANNEL_CANARY value */
            CHANNEL_CANARY = 4,

            /** CHANNEL_UNKNOWN value */
            CHANNEL_UNKNOWN = 5
        }
    }

    /**
     * Properties of an AndroidCheckinProto.
     * @deprecated Use checkin_proto.AndroidCheckinProto.$Properties instead.
     */
    interface IAndroidCheckinProto extends checkin_proto.AndroidCheckinProto.$Properties {
    }

    /** Represents an AndroidCheckinProto. */
    class AndroidCheckinProto {

        /**
         * Constructs a new AndroidCheckinProto.
         * @param [properties] Properties to set
         */
        constructor(properties?: checkin_proto.AndroidCheckinProto.$Properties);

        /** Unknown fields preserved while decoding when enabled */
        $unknowns?: Uint8Array[];

        /** AndroidCheckinProto lastCheckinMsec. */
        lastCheckinMsec: (number|Long);

        /** AndroidCheckinProto cellOperator. */
        cellOperator: string;

        /** AndroidCheckinProto simOperator. */
        simOperator: string;

        /** AndroidCheckinProto roaming. */
        roaming: string;

        /** AndroidCheckinProto userNumber. */
        userNumber: number;

        /** AndroidCheckinProto type. */
        type: checkin_proto.DeviceType;

        /** AndroidCheckinProto chromeBuild. */
        chromeBuild?: (checkin_proto.ChromeBuildProto.$Properties|null);

        /**
         * Creates a new AndroidCheckinProto instance using the specified properties.
         * @param [properties] Properties to set
         * @returns AndroidCheckinProto instance
         */
        static create(properties: checkin_proto.AndroidCheckinProto.$Shape): checkin_proto.AndroidCheckinProto & checkin_proto.AndroidCheckinProto.$Shape;
        static create(properties?: checkin_proto.AndroidCheckinProto.$Properties): checkin_proto.AndroidCheckinProto;

        /**
         * Encodes the specified AndroidCheckinProto message. Does not implicitly {@link checkin_proto.AndroidCheckinProto.verify|verify} messages.
         * @param message AndroidCheckinProto message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        static encode(message: checkin_proto.AndroidCheckinProto.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified AndroidCheckinProto message, length delimited. Does not implicitly {@link checkin_proto.AndroidCheckinProto.verify|verify} messages.
         * @param message AndroidCheckinProto message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        static encodeDelimited(message: checkin_proto.AndroidCheckinProto.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes an AndroidCheckinProto message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns {checkin_proto.AndroidCheckinProto & checkin_proto.AndroidCheckinProto.$Shape} AndroidCheckinProto
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): checkin_proto.AndroidCheckinProto & checkin_proto.AndroidCheckinProto.$Shape;

        /**
         * Decodes an AndroidCheckinProto message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns {checkin_proto.AndroidCheckinProto & checkin_proto.AndroidCheckinProto.$Shape} AndroidCheckinProto
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): checkin_proto.AndroidCheckinProto & checkin_proto.AndroidCheckinProto.$Shape;

        /**
         * Verifies an AndroidCheckinProto message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates an AndroidCheckinProto message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns AndroidCheckinProto
         */
        static fromObject(object: { [k: string]: any }): checkin_proto.AndroidCheckinProto;

        /**
         * Creates a plain object from an AndroidCheckinProto message. Also converts values to other types if specified.
         * @param message AndroidCheckinProto
         * @param [options] Conversion options
         * @returns Plain object
         */
        static toObject(message: checkin_proto.AndroidCheckinProto, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this AndroidCheckinProto to JSON.
         * @returns JSON object
         */
        toJSON(): { [k: string]: any };

        /**
         * Gets the type url for AndroidCheckinProto
         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
         * @returns The type url
         */
        static getTypeUrl(prefix?: string): string;
    }

    namespace AndroidCheckinProto {

        /** Properties of an AndroidCheckinProto. */
        interface $Properties {

            /** AndroidCheckinProto lastCheckinMsec */
            lastCheckinMsec?: (number|Long|null);

            /** AndroidCheckinProto cellOperator */
            cellOperator?: (string|null);

            /** AndroidCheckinProto simOperator */
            simOperator?: (string|null);

            /** AndroidCheckinProto roaming */
            roaming?: (string|null);

            /** AndroidCheckinProto userNumber */
            userNumber?: (number|null);

            /** AndroidCheckinProto type */
            type?: (checkin_proto.DeviceType|null);

            /** AndroidCheckinProto chromeBuild */
            chromeBuild?: (checkin_proto.ChromeBuildProto.$Properties|null);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];
        }

        /** Shape of an AndroidCheckinProto. */
        type $Shape = checkin_proto.AndroidCheckinProto.$Properties;
    }

    /** DeviceType enum. */
    enum DeviceType {

        /** DEVICE_ANDROID_OS value */
        DEVICE_ANDROID_OS = 1,

        /** DEVICE_IOS_OS value */
        DEVICE_IOS_OS = 2,

        /** DEVICE_CHROME_BROWSER value */
        DEVICE_CHROME_BROWSER = 3,

        /** DEVICE_CHROME_OS value */
        DEVICE_CHROME_OS = 4
    }

    /**
     * Properties of a GservicesSetting.
     * @deprecated Use checkin_proto.GservicesSetting.$Properties instead.
     */
    interface IGservicesSetting extends checkin_proto.GservicesSetting.$Properties {
    }

    /** Represents a GservicesSetting. */
    class GservicesSetting {

        /**
         * Constructs a new GservicesSetting.
         * @param [properties] Properties to set
         */
        constructor(properties?: checkin_proto.GservicesSetting.$Properties);

        /** Unknown fields preserved while decoding when enabled */
        $unknowns?: Uint8Array[];

        /** GservicesSetting name. */
        name: Uint8Array;

        /** GservicesSetting value. */
        value: Uint8Array;

        /**
         * Creates a new GservicesSetting instance using the specified properties.
         * @param [properties] Properties to set
         * @returns GservicesSetting instance
         */
        static create(properties: checkin_proto.GservicesSetting.$Shape): checkin_proto.GservicesSetting & checkin_proto.GservicesSetting.$Shape;
        static create(properties?: checkin_proto.GservicesSetting.$Properties): checkin_proto.GservicesSetting;

        /**
         * Encodes the specified GservicesSetting message. Does not implicitly {@link checkin_proto.GservicesSetting.verify|verify} messages.
         * @param message GservicesSetting message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        static encode(message: checkin_proto.GservicesSetting.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified GservicesSetting message, length delimited. Does not implicitly {@link checkin_proto.GservicesSetting.verify|verify} messages.
         * @param message GservicesSetting message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        static encodeDelimited(message: checkin_proto.GservicesSetting.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a GservicesSetting message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns {checkin_proto.GservicesSetting & checkin_proto.GservicesSetting.$Shape} GservicesSetting
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): checkin_proto.GservicesSetting & checkin_proto.GservicesSetting.$Shape;

        /**
         * Decodes a GservicesSetting message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns {checkin_proto.GservicesSetting & checkin_proto.GservicesSetting.$Shape} GservicesSetting
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): checkin_proto.GservicesSetting & checkin_proto.GservicesSetting.$Shape;

        /**
         * Verifies a GservicesSetting message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a GservicesSetting message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns GservicesSetting
         */
        static fromObject(object: { [k: string]: any }): checkin_proto.GservicesSetting;

        /**
         * Creates a plain object from a GservicesSetting message. Also converts values to other types if specified.
         * @param message GservicesSetting
         * @param [options] Conversion options
         * @returns Plain object
         */
        static toObject(message: checkin_proto.GservicesSetting, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this GservicesSetting to JSON.
         * @returns JSON object
         */
        toJSON(): { [k: string]: any };

        /**
         * Gets the type url for GservicesSetting
         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
         * @returns The type url
         */
        static getTypeUrl(prefix?: string): string;
    }

    namespace GservicesSetting {

        /** Properties of a GservicesSetting. */
        interface $Properties {

            /** GservicesSetting name */
            name: Uint8Array;

            /** GservicesSetting value */
            value: Uint8Array;

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];
        }

        /** Shape of a GservicesSetting. */
        type $Shape = checkin_proto.GservicesSetting.$Properties;
    }

    /**
     * Properties of an AndroidCheckinRequest.
     * @deprecated Use checkin_proto.AndroidCheckinRequest.$Properties instead.
     */
    interface IAndroidCheckinRequest extends checkin_proto.AndroidCheckinRequest.$Properties {
    }

    /** Represents an AndroidCheckinRequest. */
    class AndroidCheckinRequest {

        /**
         * Constructs a new AndroidCheckinRequest.
         * @param [properties] Properties to set
         */
        constructor(properties?: checkin_proto.AndroidCheckinRequest.$Properties);

        /** Unknown fields preserved while decoding when enabled */
        $unknowns?: Uint8Array[];

        /** AndroidCheckinRequest imei. */
        imei: string;

        /** AndroidCheckinRequest meid. */
        meid: string;

        /** AndroidCheckinRequest macAddr. */
        macAddr: string[];

        /** AndroidCheckinRequest macAddrType. */
        macAddrType: string[];

        /** AndroidCheckinRequest serialNumber. */
        serialNumber: string;

        /** AndroidCheckinRequest esn. */
        esn: string;

        /** AndroidCheckinRequest id. */
        id: (number|Long);

        /** AndroidCheckinRequest loggingId. */
        loggingId: (number|Long);

        /** AndroidCheckinRequest digest. */
        digest: string;

        /** AndroidCheckinRequest locale. */
        locale: string;

        /** AndroidCheckinRequest checkin. */
        checkin: checkin_proto.AndroidCheckinProto.$Properties;

        /** AndroidCheckinRequest desiredBuild. */
        desiredBuild: string;

        /** AndroidCheckinRequest marketCheckin. */
        marketCheckin: string;

        /** AndroidCheckinRequest accountCookie. */
        accountCookie: string[];

        /** AndroidCheckinRequest timeZone. */
        timeZone: string;

        /** AndroidCheckinRequest securityToken. */
        securityToken: (number|Long);

        /** AndroidCheckinRequest version. */
        version: number;

        /** AndroidCheckinRequest otaCert. */
        otaCert: string[];

        /** AndroidCheckinRequest fragment. */
        fragment: number;

        /** AndroidCheckinRequest userName. */
        userName: string;

        /** AndroidCheckinRequest userSerialNumber. */
        userSerialNumber: number;

        /**
         * Creates a new AndroidCheckinRequest instance using the specified properties.
         * @param [properties] Properties to set
         * @returns AndroidCheckinRequest instance
         */
        static create(properties: checkin_proto.AndroidCheckinRequest.$Shape): checkin_proto.AndroidCheckinRequest & checkin_proto.AndroidCheckinRequest.$Shape;
        static create(properties?: checkin_proto.AndroidCheckinRequest.$Properties): checkin_proto.AndroidCheckinRequest;

        /**
         * Encodes the specified AndroidCheckinRequest message. Does not implicitly {@link checkin_proto.AndroidCheckinRequest.verify|verify} messages.
         * @param message AndroidCheckinRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        static encode(message: checkin_proto.AndroidCheckinRequest.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified AndroidCheckinRequest message, length delimited. Does not implicitly {@link checkin_proto.AndroidCheckinRequest.verify|verify} messages.
         * @param message AndroidCheckinRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        static encodeDelimited(message: checkin_proto.AndroidCheckinRequest.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes an AndroidCheckinRequest message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns {checkin_proto.AndroidCheckinRequest & checkin_proto.AndroidCheckinRequest.$Shape} AndroidCheckinRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): checkin_proto.AndroidCheckinRequest & checkin_proto.AndroidCheckinRequest.$Shape;

        /**
         * Decodes an AndroidCheckinRequest message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns {checkin_proto.AndroidCheckinRequest & checkin_proto.AndroidCheckinRequest.$Shape} AndroidCheckinRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): checkin_proto.AndroidCheckinRequest & checkin_proto.AndroidCheckinRequest.$Shape;

        /**
         * Verifies an AndroidCheckinRequest message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates an AndroidCheckinRequest message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns AndroidCheckinRequest
         */
        static fromObject(object: { [k: string]: any }): checkin_proto.AndroidCheckinRequest;

        /**
         * Creates a plain object from an AndroidCheckinRequest message. Also converts values to other types if specified.
         * @param message AndroidCheckinRequest
         * @param [options] Conversion options
         * @returns Plain object
         */
        static toObject(message: checkin_proto.AndroidCheckinRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this AndroidCheckinRequest to JSON.
         * @returns JSON object
         */
        toJSON(): { [k: string]: any };

        /**
         * Gets the type url for AndroidCheckinRequest
         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
         * @returns The type url
         */
        static getTypeUrl(prefix?: string): string;
    }

    namespace AndroidCheckinRequest {

        /** Properties of an AndroidCheckinRequest. */
        interface $Properties {

            /** AndroidCheckinRequest imei */
            imei?: (string|null);

            /** AndroidCheckinRequest meid */
            meid?: (string|null);

            /** AndroidCheckinRequest macAddr */
            macAddr?: (string[]|null);

            /** AndroidCheckinRequest macAddrType */
            macAddrType?: (string[]|null);

            /** AndroidCheckinRequest serialNumber */
            serialNumber?: (string|null);

            /** AndroidCheckinRequest esn */
            esn?: (string|null);

            /** AndroidCheckinRequest id */
            id?: (number|Long|null);

            /** AndroidCheckinRequest loggingId */
            loggingId?: (number|Long|null);

            /** AndroidCheckinRequest digest */
            digest?: (string|null);

            /** AndroidCheckinRequest locale */
            locale?: (string|null);

            /** AndroidCheckinRequest checkin */
            checkin: checkin_proto.AndroidCheckinProto.$Properties;

            /** AndroidCheckinRequest desiredBuild */
            desiredBuild?: (string|null);

            /** AndroidCheckinRequest marketCheckin */
            marketCheckin?: (string|null);

            /** AndroidCheckinRequest accountCookie */
            accountCookie?: (string[]|null);

            /** AndroidCheckinRequest timeZone */
            timeZone?: (string|null);

            /** AndroidCheckinRequest securityToken */
            securityToken?: (number|Long|null);

            /** AndroidCheckinRequest version */
            version?: (number|null);

            /** AndroidCheckinRequest otaCert */
            otaCert?: (string[]|null);

            /** AndroidCheckinRequest fragment */
            fragment?: (number|null);

            /** AndroidCheckinRequest userName */
            userName?: (string|null);

            /** AndroidCheckinRequest userSerialNumber */
            userSerialNumber?: (number|null);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];
        }

        /** Shape of an AndroidCheckinRequest. */
        type $Shape = checkin_proto.AndroidCheckinRequest.$Properties;
    }

    /**
     * Properties of an AndroidCheckinResponse.
     * @deprecated Use checkin_proto.AndroidCheckinResponse.$Properties instead.
     */
    interface IAndroidCheckinResponse extends checkin_proto.AndroidCheckinResponse.$Properties {
    }

    /** Represents an AndroidCheckinResponse. */
    class AndroidCheckinResponse {

        /**
         * Constructs a new AndroidCheckinResponse.
         * @param [properties] Properties to set
         */
        constructor(properties?: checkin_proto.AndroidCheckinResponse.$Properties);

        /** Unknown fields preserved while decoding when enabled */
        $unknowns?: Uint8Array[];

        /** AndroidCheckinResponse statsOk. */
        statsOk: boolean;

        /** AndroidCheckinResponse timeMsec. */
        timeMsec: (number|Long);

        /** AndroidCheckinResponse digest. */
        digest: string;

        /** AndroidCheckinResponse settingsDiff. */
        settingsDiff: boolean;

        /** AndroidCheckinResponse deleteSetting. */
        deleteSetting: string[];

        /** AndroidCheckinResponse setting. */
        setting: checkin_proto.GservicesSetting.$Properties[];

        /** AndroidCheckinResponse marketOk. */
        marketOk: boolean;

        /** AndroidCheckinResponse androidId. */
        androidId: (number|Long);

        /** AndroidCheckinResponse securityToken. */
        securityToken: (number|Long);

        /** AndroidCheckinResponse versionInfo. */
        versionInfo: string;

        /**
         * Creates a new AndroidCheckinResponse instance using the specified properties.
         * @param [properties] Properties to set
         * @returns AndroidCheckinResponse instance
         */
        static create(properties: checkin_proto.AndroidCheckinResponse.$Shape): checkin_proto.AndroidCheckinResponse & checkin_proto.AndroidCheckinResponse.$Shape;
        static create(properties?: checkin_proto.AndroidCheckinResponse.$Properties): checkin_proto.AndroidCheckinResponse;

        /**
         * Encodes the specified AndroidCheckinResponse message. Does not implicitly {@link checkin_proto.AndroidCheckinResponse.verify|verify} messages.
         * @param message AndroidCheckinResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        static encode(message: checkin_proto.AndroidCheckinResponse.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified AndroidCheckinResponse message, length delimited. Does not implicitly {@link checkin_proto.AndroidCheckinResponse.verify|verify} messages.
         * @param message AndroidCheckinResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        static encodeDelimited(message: checkin_proto.AndroidCheckinResponse.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes an AndroidCheckinResponse message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns {checkin_proto.AndroidCheckinResponse & checkin_proto.AndroidCheckinResponse.$Shape} AndroidCheckinResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): checkin_proto.AndroidCheckinResponse & checkin_proto.AndroidCheckinResponse.$Shape;

        /**
         * Decodes an AndroidCheckinResponse message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns {checkin_proto.AndroidCheckinResponse & checkin_proto.AndroidCheckinResponse.$Shape} AndroidCheckinResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): checkin_proto.AndroidCheckinResponse & checkin_proto.AndroidCheckinResponse.$Shape;

        /**
         * Verifies an AndroidCheckinResponse message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates an AndroidCheckinResponse message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns AndroidCheckinResponse
         */
        static fromObject(object: { [k: string]: any }): checkin_proto.AndroidCheckinResponse;

        /**
         * Creates a plain object from an AndroidCheckinResponse message. Also converts values to other types if specified.
         * @param message AndroidCheckinResponse
         * @param [options] Conversion options
         * @returns Plain object
         */
        static toObject(message: checkin_proto.AndroidCheckinResponse, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this AndroidCheckinResponse to JSON.
         * @returns JSON object
         */
        toJSON(): { [k: string]: any };

        /**
         * Gets the type url for AndroidCheckinResponse
         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
         * @returns The type url
         */
        static getTypeUrl(prefix?: string): string;
    }

    namespace AndroidCheckinResponse {

        /** Properties of an AndroidCheckinResponse. */
        interface $Properties {

            /** AndroidCheckinResponse statsOk */
            statsOk: boolean;

            /** AndroidCheckinResponse timeMsec */
            timeMsec?: (number|Long|null);

            /** AndroidCheckinResponse digest */
            digest?: (string|null);

            /** AndroidCheckinResponse settingsDiff */
            settingsDiff?: (boolean|null);

            /** AndroidCheckinResponse deleteSetting */
            deleteSetting?: (string[]|null);

            /** AndroidCheckinResponse setting */
            setting?: (checkin_proto.GservicesSetting.$Properties[]|null);

            /** AndroidCheckinResponse marketOk */
            marketOk?: (boolean|null);

            /** AndroidCheckinResponse androidId */
            androidId?: (number|Long|null);

            /** AndroidCheckinResponse securityToken */
            securityToken?: (number|Long|null);

            /** AndroidCheckinResponse versionInfo */
            versionInfo?: (string|null);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];
        }

        /** Shape of an AndroidCheckinResponse. */
        type $Shape = checkin_proto.AndroidCheckinResponse.$Properties;
    }
}

/** Namespace mcs_proto. */
export namespace mcs_proto {

    /**
     * Properties of a HeartbeatPing.
     * @deprecated Use mcs_proto.HeartbeatPing.$Properties instead.
     */
    interface IHeartbeatPing extends mcs_proto.HeartbeatPing.$Properties {
    }

    /** TAG: 0 */
    class HeartbeatPing {

        /**
         * Constructs a new HeartbeatPing.
         * @param [properties] Properties to set
         */
        constructor(properties?: mcs_proto.HeartbeatPing.$Properties);

        /** Unknown fields preserved while decoding when enabled */
        $unknowns?: Uint8Array[];

        /** HeartbeatPing streamId. */
        streamId: number;

        /** HeartbeatPing lastStreamIdReceived. */
        lastStreamIdReceived: number;

        /** HeartbeatPing status. */
        status: (number|Long);

        /**
         * Creates a new HeartbeatPing instance using the specified properties.
         * @param [properties] Properties to set
         * @returns HeartbeatPing instance
         */
        static create(properties: mcs_proto.HeartbeatPing.$Shape): mcs_proto.HeartbeatPing & mcs_proto.HeartbeatPing.$Shape;
        static create(properties?: mcs_proto.HeartbeatPing.$Properties): mcs_proto.HeartbeatPing;

        /**
         * Encodes the specified HeartbeatPing message. Does not implicitly {@link mcs_proto.HeartbeatPing.verify|verify} messages.
         * @param message HeartbeatPing message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        static encode(message: mcs_proto.HeartbeatPing.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified HeartbeatPing message, length delimited. Does not implicitly {@link mcs_proto.HeartbeatPing.verify|verify} messages.
         * @param message HeartbeatPing message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        static encodeDelimited(message: mcs_proto.HeartbeatPing.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a HeartbeatPing message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns {mcs_proto.HeartbeatPing & mcs_proto.HeartbeatPing.$Shape} HeartbeatPing
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): mcs_proto.HeartbeatPing & mcs_proto.HeartbeatPing.$Shape;

        /**
         * Decodes a HeartbeatPing message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns {mcs_proto.HeartbeatPing & mcs_proto.HeartbeatPing.$Shape} HeartbeatPing
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): mcs_proto.HeartbeatPing & mcs_proto.HeartbeatPing.$Shape;

        /**
         * Verifies a HeartbeatPing message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a HeartbeatPing message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns HeartbeatPing
         */
        static fromObject(object: { [k: string]: any }): mcs_proto.HeartbeatPing;

        /**
         * Creates a plain object from a HeartbeatPing message. Also converts values to other types if specified.
         * @param message HeartbeatPing
         * @param [options] Conversion options
         * @returns Plain object
         */
        static toObject(message: mcs_proto.HeartbeatPing, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this HeartbeatPing to JSON.
         * @returns JSON object
         */
        toJSON(): { [k: string]: any };

        /**
         * Gets the type url for HeartbeatPing
         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
         * @returns The type url
         */
        static getTypeUrl(prefix?: string): string;
    }

    namespace HeartbeatPing {

        /** Properties of a HeartbeatPing. */
        interface $Properties {

            /** HeartbeatPing streamId */
            streamId?: (number|null);

            /** HeartbeatPing lastStreamIdReceived */
            lastStreamIdReceived?: (number|null);

            /** HeartbeatPing status */
            status?: (number|Long|null);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];
        }

        /** Shape of a HeartbeatPing. */
        type $Shape = mcs_proto.HeartbeatPing.$Properties;
    }

    /**
     * Properties of a HeartbeatAck.
     * @deprecated Use mcs_proto.HeartbeatAck.$Properties instead.
     */
    interface IHeartbeatAck extends mcs_proto.HeartbeatAck.$Properties {
    }

    /** TAG: 1 */
    class HeartbeatAck {

        /**
         * Constructs a new HeartbeatAck.
         * @param [properties] Properties to set
         */
        constructor(properties?: mcs_proto.HeartbeatAck.$Properties);

        /** Unknown fields preserved while decoding when enabled */
        $unknowns?: Uint8Array[];

        /** HeartbeatAck streamId. */
        streamId: number;

        /** HeartbeatAck lastStreamIdReceived. */
        lastStreamIdReceived: number;

        /** HeartbeatAck status. */
        status: (number|Long);

        /**
         * Creates a new HeartbeatAck instance using the specified properties.
         * @param [properties] Properties to set
         * @returns HeartbeatAck instance
         */
        static create(properties: mcs_proto.HeartbeatAck.$Shape): mcs_proto.HeartbeatAck & mcs_proto.HeartbeatAck.$Shape;
        static create(properties?: mcs_proto.HeartbeatAck.$Properties): mcs_proto.HeartbeatAck;

        /**
         * Encodes the specified HeartbeatAck message. Does not implicitly {@link mcs_proto.HeartbeatAck.verify|verify} messages.
         * @param message HeartbeatAck message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        static encode(message: mcs_proto.HeartbeatAck.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified HeartbeatAck message, length delimited. Does not implicitly {@link mcs_proto.HeartbeatAck.verify|verify} messages.
         * @param message HeartbeatAck message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        static encodeDelimited(message: mcs_proto.HeartbeatAck.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a HeartbeatAck message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns {mcs_proto.HeartbeatAck & mcs_proto.HeartbeatAck.$Shape} HeartbeatAck
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): mcs_proto.HeartbeatAck & mcs_proto.HeartbeatAck.$Shape;

        /**
         * Decodes a HeartbeatAck message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns {mcs_proto.HeartbeatAck & mcs_proto.HeartbeatAck.$Shape} HeartbeatAck
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): mcs_proto.HeartbeatAck & mcs_proto.HeartbeatAck.$Shape;

        /**
         * Verifies a HeartbeatAck message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a HeartbeatAck message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns HeartbeatAck
         */
        static fromObject(object: { [k: string]: any }): mcs_proto.HeartbeatAck;

        /**
         * Creates a plain object from a HeartbeatAck message. Also converts values to other types if specified.
         * @param message HeartbeatAck
         * @param [options] Conversion options
         * @returns Plain object
         */
        static toObject(message: mcs_proto.HeartbeatAck, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this HeartbeatAck to JSON.
         * @returns JSON object
         */
        toJSON(): { [k: string]: any };

        /**
         * Gets the type url for HeartbeatAck
         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
         * @returns The type url
         */
        static getTypeUrl(prefix?: string): string;
    }

    namespace HeartbeatAck {

        /** Properties of a HeartbeatAck. */
        interface $Properties {

            /** HeartbeatAck streamId */
            streamId?: (number|null);

            /** HeartbeatAck lastStreamIdReceived */
            lastStreamIdReceived?: (number|null);

            /** HeartbeatAck status */
            status?: (number|Long|null);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];
        }

        /** Shape of a HeartbeatAck. */
        type $Shape = mcs_proto.HeartbeatAck.$Properties;
    }

    /**
     * Properties of an ErrorInfo.
     * @deprecated Use mcs_proto.ErrorInfo.$Properties instead.
     */
    interface IErrorInfo extends mcs_proto.ErrorInfo.$Properties {
    }

    /** Represents an ErrorInfo. */
    class ErrorInfo {

        /**
         * Constructs a new ErrorInfo.
         * @param [properties] Properties to set
         */
        constructor(properties?: mcs_proto.ErrorInfo.$Properties);

        /** Unknown fields preserved while decoding when enabled */
        $unknowns?: Uint8Array[];

        /** ErrorInfo code. */
        code: number;

        /** ErrorInfo message. */
        message: string;

        /** ErrorInfo type. */
        type: string;

        /** ErrorInfo extension. */
        extension?: (mcs_proto.Extension.$Properties|null);

        /**
         * Creates a new ErrorInfo instance using the specified properties.
         * @param [properties] Properties to set
         * @returns ErrorInfo instance
         */
        static create(properties: mcs_proto.ErrorInfo.$Shape): mcs_proto.ErrorInfo & mcs_proto.ErrorInfo.$Shape;
        static create(properties?: mcs_proto.ErrorInfo.$Properties): mcs_proto.ErrorInfo;

        /**
         * Encodes the specified ErrorInfo message. Does not implicitly {@link mcs_proto.ErrorInfo.verify|verify} messages.
         * @param message ErrorInfo message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        static encode(message: mcs_proto.ErrorInfo.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified ErrorInfo message, length delimited. Does not implicitly {@link mcs_proto.ErrorInfo.verify|verify} messages.
         * @param message ErrorInfo message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        static encodeDelimited(message: mcs_proto.ErrorInfo.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes an ErrorInfo message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns {mcs_proto.ErrorInfo & mcs_proto.ErrorInfo.$Shape} ErrorInfo
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): mcs_proto.ErrorInfo & mcs_proto.ErrorInfo.$Shape;

        /**
         * Decodes an ErrorInfo message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns {mcs_proto.ErrorInfo & mcs_proto.ErrorInfo.$Shape} ErrorInfo
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): mcs_proto.ErrorInfo & mcs_proto.ErrorInfo.$Shape;

        /**
         * Verifies an ErrorInfo message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates an ErrorInfo message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns ErrorInfo
         */
        static fromObject(object: { [k: string]: any }): mcs_proto.ErrorInfo;

        /**
         * Creates a plain object from an ErrorInfo message. Also converts values to other types if specified.
         * @param message ErrorInfo
         * @param [options] Conversion options
         * @returns Plain object
         */
        static toObject(message: mcs_proto.ErrorInfo, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this ErrorInfo to JSON.
         * @returns JSON object
         */
        toJSON(): { [k: string]: any };

        /**
         * Gets the type url for ErrorInfo
         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
         * @returns The type url
         */
        static getTypeUrl(prefix?: string): string;
    }

    namespace ErrorInfo {

        /** Properties of an ErrorInfo. */
        interface $Properties {

            /** ErrorInfo code */
            code: number;

            /** ErrorInfo message */
            message?: (string|null);

            /** ErrorInfo type */
            type?: (string|null);

            /** ErrorInfo extension */
            extension?: (mcs_proto.Extension.$Properties|null);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];
        }

        /** Shape of an ErrorInfo. */
        type $Shape = mcs_proto.ErrorInfo.$Properties;
    }

    /**
     * Properties of a Setting.
     * @deprecated Use mcs_proto.Setting.$Properties instead.
     */
    interface ISetting extends mcs_proto.Setting.$Properties {
    }

    /** Represents a Setting. */
    class Setting {

        /**
         * Constructs a new Setting.
         * @param [properties] Properties to set
         */
        constructor(properties?: mcs_proto.Setting.$Properties);

        /** Unknown fields preserved while decoding when enabled */
        $unknowns?: Uint8Array[];

        /** Setting name. */
        name: string;

        /** Setting value. */
        value: string;

        /**
         * Creates a new Setting instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Setting instance
         */
        static create(properties: mcs_proto.Setting.$Shape): mcs_proto.Setting & mcs_proto.Setting.$Shape;
        static create(properties?: mcs_proto.Setting.$Properties): mcs_proto.Setting;

        /**
         * Encodes the specified Setting message. Does not implicitly {@link mcs_proto.Setting.verify|verify} messages.
         * @param message Setting message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        static encode(message: mcs_proto.Setting.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified Setting message, length delimited. Does not implicitly {@link mcs_proto.Setting.verify|verify} messages.
         * @param message Setting message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        static encodeDelimited(message: mcs_proto.Setting.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a Setting message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns {mcs_proto.Setting & mcs_proto.Setting.$Shape} Setting
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): mcs_proto.Setting & mcs_proto.Setting.$Shape;

        /**
         * Decodes a Setting message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns {mcs_proto.Setting & mcs_proto.Setting.$Shape} Setting
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): mcs_proto.Setting & mcs_proto.Setting.$Shape;

        /**
         * Verifies a Setting message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a Setting message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Setting
         */
        static fromObject(object: { [k: string]: any }): mcs_proto.Setting;

        /**
         * Creates a plain object from a Setting message. Also converts values to other types if specified.
         * @param message Setting
         * @param [options] Conversion options
         * @returns Plain object
         */
        static toObject(message: mcs_proto.Setting, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this Setting to JSON.
         * @returns JSON object
         */
        toJSON(): { [k: string]: any };

        /**
         * Gets the type url for Setting
         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
         * @returns The type url
         */
        static getTypeUrl(prefix?: string): string;
    }

    namespace Setting {

        /** Properties of a Setting. */
        interface $Properties {

            /** Setting name */
            name: string;

            /** Setting value */
            value: string;

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];
        }

        /** Shape of a Setting. */
        type $Shape = mcs_proto.Setting.$Properties;
    }

    /**
     * Properties of a HeartbeatStat.
     * @deprecated Use mcs_proto.HeartbeatStat.$Properties instead.
     */
    interface IHeartbeatStat extends mcs_proto.HeartbeatStat.$Properties {
    }

    /** Represents a HeartbeatStat. */
    class HeartbeatStat {

        /**
         * Constructs a new HeartbeatStat.
         * @param [properties] Properties to set
         */
        constructor(properties?: mcs_proto.HeartbeatStat.$Properties);

        /** Unknown fields preserved while decoding when enabled */
        $unknowns?: Uint8Array[];

        /** HeartbeatStat ip. */
        ip: string;

        /** HeartbeatStat timeout. */
        timeout: boolean;

        /** HeartbeatStat intervalMs. */
        intervalMs: number;

        /**
         * Creates a new HeartbeatStat instance using the specified properties.
         * @param [properties] Properties to set
         * @returns HeartbeatStat instance
         */
        static create(properties: mcs_proto.HeartbeatStat.$Shape): mcs_proto.HeartbeatStat & mcs_proto.HeartbeatStat.$Shape;
        static create(properties?: mcs_proto.HeartbeatStat.$Properties): mcs_proto.HeartbeatStat;

        /**
         * Encodes the specified HeartbeatStat message. Does not implicitly {@link mcs_proto.HeartbeatStat.verify|verify} messages.
         * @param message HeartbeatStat message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        static encode(message: mcs_proto.HeartbeatStat.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified HeartbeatStat message, length delimited. Does not implicitly {@link mcs_proto.HeartbeatStat.verify|verify} messages.
         * @param message HeartbeatStat message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        static encodeDelimited(message: mcs_proto.HeartbeatStat.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a HeartbeatStat message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns {mcs_proto.HeartbeatStat & mcs_proto.HeartbeatStat.$Shape} HeartbeatStat
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): mcs_proto.HeartbeatStat & mcs_proto.HeartbeatStat.$Shape;

        /**
         * Decodes a HeartbeatStat message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns {mcs_proto.HeartbeatStat & mcs_proto.HeartbeatStat.$Shape} HeartbeatStat
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): mcs_proto.HeartbeatStat & mcs_proto.HeartbeatStat.$Shape;

        /**
         * Verifies a HeartbeatStat message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a HeartbeatStat message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns HeartbeatStat
         */
        static fromObject(object: { [k: string]: any }): mcs_proto.HeartbeatStat;

        /**
         * Creates a plain object from a HeartbeatStat message. Also converts values to other types if specified.
         * @param message HeartbeatStat
         * @param [options] Conversion options
         * @returns Plain object
         */
        static toObject(message: mcs_proto.HeartbeatStat, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this HeartbeatStat to JSON.
         * @returns JSON object
         */
        toJSON(): { [k: string]: any };

        /**
         * Gets the type url for HeartbeatStat
         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
         * @returns The type url
         */
        static getTypeUrl(prefix?: string): string;
    }

    namespace HeartbeatStat {

        /** Properties of a HeartbeatStat. */
        interface $Properties {

            /** HeartbeatStat ip */
            ip: string;

            /** HeartbeatStat timeout */
            timeout: boolean;

            /** HeartbeatStat intervalMs */
            intervalMs: number;

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];
        }

        /** Shape of a HeartbeatStat. */
        type $Shape = mcs_proto.HeartbeatStat.$Properties;
    }

    /**
     * Properties of a HeartbeatConfig.
     * @deprecated Use mcs_proto.HeartbeatConfig.$Properties instead.
     */
    interface IHeartbeatConfig extends mcs_proto.HeartbeatConfig.$Properties {
    }

    /** Represents a HeartbeatConfig. */
    class HeartbeatConfig {

        /**
         * Constructs a new HeartbeatConfig.
         * @param [properties] Properties to set
         */
        constructor(properties?: mcs_proto.HeartbeatConfig.$Properties);

        /** Unknown fields preserved while decoding when enabled */
        $unknowns?: Uint8Array[];

        /** HeartbeatConfig uploadStat. */
        uploadStat: boolean;

        /** HeartbeatConfig ip. */
        ip: string;

        /** HeartbeatConfig intervalMs. */
        intervalMs: number;

        /**
         * Creates a new HeartbeatConfig instance using the specified properties.
         * @param [properties] Properties to set
         * @returns HeartbeatConfig instance
         */
        static create(properties: mcs_proto.HeartbeatConfig.$Shape): mcs_proto.HeartbeatConfig & mcs_proto.HeartbeatConfig.$Shape;
        static create(properties?: mcs_proto.HeartbeatConfig.$Properties): mcs_proto.HeartbeatConfig;

        /**
         * Encodes the specified HeartbeatConfig message. Does not implicitly {@link mcs_proto.HeartbeatConfig.verify|verify} messages.
         * @param message HeartbeatConfig message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        static encode(message: mcs_proto.HeartbeatConfig.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified HeartbeatConfig message, length delimited. Does not implicitly {@link mcs_proto.HeartbeatConfig.verify|verify} messages.
         * @param message HeartbeatConfig message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        static encodeDelimited(message: mcs_proto.HeartbeatConfig.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a HeartbeatConfig message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns {mcs_proto.HeartbeatConfig & mcs_proto.HeartbeatConfig.$Shape} HeartbeatConfig
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): mcs_proto.HeartbeatConfig & mcs_proto.HeartbeatConfig.$Shape;

        /**
         * Decodes a HeartbeatConfig message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns {mcs_proto.HeartbeatConfig & mcs_proto.HeartbeatConfig.$Shape} HeartbeatConfig
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): mcs_proto.HeartbeatConfig & mcs_proto.HeartbeatConfig.$Shape;

        /**
         * Verifies a HeartbeatConfig message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a HeartbeatConfig message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns HeartbeatConfig
         */
        static fromObject(object: { [k: string]: any }): mcs_proto.HeartbeatConfig;

        /**
         * Creates a plain object from a HeartbeatConfig message. Also converts values to other types if specified.
         * @param message HeartbeatConfig
         * @param [options] Conversion options
         * @returns Plain object
         */
        static toObject(message: mcs_proto.HeartbeatConfig, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this HeartbeatConfig to JSON.
         * @returns JSON object
         */
        toJSON(): { [k: string]: any };

        /**
         * Gets the type url for HeartbeatConfig
         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
         * @returns The type url
         */
        static getTypeUrl(prefix?: string): string;
    }

    namespace HeartbeatConfig {

        /** Properties of a HeartbeatConfig. */
        interface $Properties {

            /** HeartbeatConfig uploadStat */
            uploadStat?: (boolean|null);

            /** HeartbeatConfig ip */
            ip?: (string|null);

            /** HeartbeatConfig intervalMs */
            intervalMs?: (number|null);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];
        }

        /** Shape of a HeartbeatConfig. */
        type $Shape = mcs_proto.HeartbeatConfig.$Properties;
    }

    /**
     * Properties of a ClientEvent.
     * @deprecated Use mcs_proto.ClientEvent.$Properties instead.
     */
    interface IClientEvent extends mcs_proto.ClientEvent.$Properties {
    }

    /** Represents a ClientEvent. */
    class ClientEvent {

        /**
         * Constructs a new ClientEvent.
         * @param [properties] Properties to set
         */
        constructor(properties?: mcs_proto.ClientEvent.$Properties);

        /** Unknown fields preserved while decoding when enabled */
        $unknowns?: Uint8Array[];

        /** ClientEvent type. */
        type: mcs_proto.ClientEvent.Type;

        /** ClientEvent numberDiscardedEvents. */
        numberDiscardedEvents: number;

        /** ClientEvent networkType. */
        networkType: number;

        /** ClientEvent timeConnectionStartedMs. */
        timeConnectionStartedMs: (number|Long);

        /** ClientEvent timeConnectionEndedMs. */
        timeConnectionEndedMs: (number|Long);

        /** ClientEvent errorCode. */
        errorCode: number;

        /** ClientEvent timeConnectionEstablishedMs. */
        timeConnectionEstablishedMs: (number|Long);

        /**
         * Creates a new ClientEvent instance using the specified properties.
         * @param [properties] Properties to set
         * @returns ClientEvent instance
         */
        static create(properties: mcs_proto.ClientEvent.$Shape): mcs_proto.ClientEvent & mcs_proto.ClientEvent.$Shape;
        static create(properties?: mcs_proto.ClientEvent.$Properties): mcs_proto.ClientEvent;

        /**
         * Encodes the specified ClientEvent message. Does not implicitly {@link mcs_proto.ClientEvent.verify|verify} messages.
         * @param message ClientEvent message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        static encode(message: mcs_proto.ClientEvent.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified ClientEvent message, length delimited. Does not implicitly {@link mcs_proto.ClientEvent.verify|verify} messages.
         * @param message ClientEvent message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        static encodeDelimited(message: mcs_proto.ClientEvent.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a ClientEvent message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns {mcs_proto.ClientEvent & mcs_proto.ClientEvent.$Shape} ClientEvent
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): mcs_proto.ClientEvent & mcs_proto.ClientEvent.$Shape;

        /**
         * Decodes a ClientEvent message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns {mcs_proto.ClientEvent & mcs_proto.ClientEvent.$Shape} ClientEvent
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): mcs_proto.ClientEvent & mcs_proto.ClientEvent.$Shape;

        /**
         * Verifies a ClientEvent message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a ClientEvent message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns ClientEvent
         */
        static fromObject(object: { [k: string]: any }): mcs_proto.ClientEvent;

        /**
         * Creates a plain object from a ClientEvent message. Also converts values to other types if specified.
         * @param message ClientEvent
         * @param [options] Conversion options
         * @returns Plain object
         */
        static toObject(message: mcs_proto.ClientEvent, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this ClientEvent to JSON.
         * @returns JSON object
         */
        toJSON(): { [k: string]: any };

        /**
         * Gets the type url for ClientEvent
         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
         * @returns The type url
         */
        static getTypeUrl(prefix?: string): string;
    }

    namespace ClientEvent {

        /** Properties of a ClientEvent. */
        interface $Properties {

            /** ClientEvent type */
            type?: (mcs_proto.ClientEvent.Type|null);

            /** ClientEvent numberDiscardedEvents */
            numberDiscardedEvents?: (number|null);

            /** ClientEvent networkType */
            networkType?: (number|null);

            /** ClientEvent timeConnectionStartedMs */
            timeConnectionStartedMs?: (number|Long|null);

            /** ClientEvent timeConnectionEndedMs */
            timeConnectionEndedMs?: (number|Long|null);

            /** ClientEvent errorCode */
            errorCode?: (number|null);

            /** ClientEvent timeConnectionEstablishedMs */
            timeConnectionEstablishedMs?: (number|Long|null);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];
        }

        /** Shape of a ClientEvent. */
        type $Shape = mcs_proto.ClientEvent.$Properties;

        /** Type enum. */
        enum Type {

            /** UNKNOWN value */
            UNKNOWN = 0,

            /** DISCARDED_EVENTS value */
            DISCARDED_EVENTS = 1,

            /** FAILED_CONNECTION value */
            FAILED_CONNECTION = 2,

            /** SUCCESSFUL_CONNECTION value */
            SUCCESSFUL_CONNECTION = 3
        }
    }

    /**
     * Properties of a LoginRequest.
     * @deprecated Use mcs_proto.LoginRequest.$Properties instead.
     */
    interface ILoginRequest extends mcs_proto.LoginRequest.$Properties {
    }

    /** TAG: 2 */
    class LoginRequest {

        /**
         * Constructs a new LoginRequest.
         * @param [properties] Properties to set
         */
        constructor(properties?: mcs_proto.LoginRequest.$Properties);

        /** Unknown fields preserved while decoding when enabled */
        $unknowns?: Uint8Array[];

        /** LoginRequest id. */
        id: string;

        /** LoginRequest domain. */
        domain: string;

        /** LoginRequest user. */
        user: string;

        /** LoginRequest resource. */
        resource: string;

        /** LoginRequest authToken. */
        authToken: string;

        /** LoginRequest deviceId. */
        deviceId: string;

        /** LoginRequest lastRmqId. */
        lastRmqId: (number|Long);

        /** LoginRequest setting. */
        setting: mcs_proto.Setting.$Properties[];

        /** LoginRequest receivedPersistentId. */
        receivedPersistentId: string[];

        /** LoginRequest adaptiveHeartbeat. */
        adaptiveHeartbeat: boolean;

        /** LoginRequest heartbeatStat. */
        heartbeatStat?: (mcs_proto.HeartbeatStat.$Properties|null);

        /** LoginRequest useRmq2. */
        useRmq2: boolean;

        /** LoginRequest accountId. */
        accountId: (number|Long);

        /** LoginRequest authService. */
        authService: mcs_proto.LoginRequest.AuthService;

        /** LoginRequest networkType. */
        networkType: number;

        /** LoginRequest status. */
        status: (number|Long);

        /** LoginRequest clientEvent. */
        clientEvent: mcs_proto.ClientEvent.$Properties[];

        /**
         * Creates a new LoginRequest instance using the specified properties.
         * @param [properties] Properties to set
         * @returns LoginRequest instance
         */
        static create(properties: mcs_proto.LoginRequest.$Shape): mcs_proto.LoginRequest & mcs_proto.LoginRequest.$Shape;
        static create(properties?: mcs_proto.LoginRequest.$Properties): mcs_proto.LoginRequest;

        /**
         * Encodes the specified LoginRequest message. Does not implicitly {@link mcs_proto.LoginRequest.verify|verify} messages.
         * @param message LoginRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        static encode(message: mcs_proto.LoginRequest.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified LoginRequest message, length delimited. Does not implicitly {@link mcs_proto.LoginRequest.verify|verify} messages.
         * @param message LoginRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        static encodeDelimited(message: mcs_proto.LoginRequest.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a LoginRequest message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns {mcs_proto.LoginRequest & mcs_proto.LoginRequest.$Shape} LoginRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): mcs_proto.LoginRequest & mcs_proto.LoginRequest.$Shape;

        /**
         * Decodes a LoginRequest message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns {mcs_proto.LoginRequest & mcs_proto.LoginRequest.$Shape} LoginRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): mcs_proto.LoginRequest & mcs_proto.LoginRequest.$Shape;

        /**
         * Verifies a LoginRequest message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a LoginRequest message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns LoginRequest
         */
        static fromObject(object: { [k: string]: any }): mcs_proto.LoginRequest;

        /**
         * Creates a plain object from a LoginRequest message. Also converts values to other types if specified.
         * @param message LoginRequest
         * @param [options] Conversion options
         * @returns Plain object
         */
        static toObject(message: mcs_proto.LoginRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this LoginRequest to JSON.
         * @returns JSON object
         */
        toJSON(): { [k: string]: any };

        /**
         * Gets the type url for LoginRequest
         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
         * @returns The type url
         */
        static getTypeUrl(prefix?: string): string;
    }

    namespace LoginRequest {

        /** Properties of a LoginRequest. */
        interface $Properties {

            /** LoginRequest id */
            id: string;

            /** LoginRequest domain */
            domain: string;

            /** LoginRequest user */
            user: string;

            /** LoginRequest resource */
            resource: string;

            /** LoginRequest authToken */
            authToken: string;

            /** LoginRequest deviceId */
            deviceId?: (string|null);

            /** LoginRequest lastRmqId */
            lastRmqId?: (number|Long|null);

            /** LoginRequest setting */
            setting?: (mcs_proto.Setting.$Properties[]|null);

            /** LoginRequest receivedPersistentId */
            receivedPersistentId?: (string[]|null);

            /** LoginRequest adaptiveHeartbeat */
            adaptiveHeartbeat?: (boolean|null);

            /** LoginRequest heartbeatStat */
            heartbeatStat?: (mcs_proto.HeartbeatStat.$Properties|null);

            /** LoginRequest useRmq2 */
            useRmq2?: (boolean|null);

            /** LoginRequest accountId */
            accountId?: (number|Long|null);

            /** LoginRequest authService */
            authService?: (mcs_proto.LoginRequest.AuthService|null);

            /** LoginRequest networkType */
            networkType?: (number|null);

            /** LoginRequest status */
            status?: (number|Long|null);

            /** LoginRequest clientEvent */
            clientEvent?: (mcs_proto.ClientEvent.$Properties[]|null);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];
        }

        /** Shape of a LoginRequest. */
        type $Shape = mcs_proto.LoginRequest.$Properties;

        /** AuthService enum. */
        enum AuthService {

            /** ANDROID_ID value */
            ANDROID_ID = 2
        }
    }

    /**
     * Properties of a LoginResponse.
     * @deprecated Use mcs_proto.LoginResponse.$Properties instead.
     */
    interface ILoginResponse extends mcs_proto.LoginResponse.$Properties {
    }

    /** TAG: 3 */
    class LoginResponse {

        /**
         * Constructs a new LoginResponse.
         * @param [properties] Properties to set
         */
        constructor(properties?: mcs_proto.LoginResponse.$Properties);

        /** Unknown fields preserved while decoding when enabled */
        $unknowns?: Uint8Array[];

        /** LoginResponse id. */
        id: string;

        /** LoginResponse jid. */
        jid: string;

        /** LoginResponse error. */
        error?: (mcs_proto.ErrorInfo.$Properties|null);

        /** LoginResponse setting. */
        setting: mcs_proto.Setting.$Properties[];

        /** LoginResponse streamId. */
        streamId: number;

        /** LoginResponse lastStreamIdReceived. */
        lastStreamIdReceived: number;

        /** LoginResponse heartbeatConfig. */
        heartbeatConfig?: (mcs_proto.HeartbeatConfig.$Properties|null);

        /** LoginResponse serverTimestamp. */
        serverTimestamp: (number|Long);

        /**
         * Creates a new LoginResponse instance using the specified properties.
         * @param [properties] Properties to set
         * @returns LoginResponse instance
         */
        static create(properties: mcs_proto.LoginResponse.$Shape): mcs_proto.LoginResponse & mcs_proto.LoginResponse.$Shape;
        static create(properties?: mcs_proto.LoginResponse.$Properties): mcs_proto.LoginResponse;

        /**
         * Encodes the specified LoginResponse message. Does not implicitly {@link mcs_proto.LoginResponse.verify|verify} messages.
         * @param message LoginResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        static encode(message: mcs_proto.LoginResponse.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified LoginResponse message, length delimited. Does not implicitly {@link mcs_proto.LoginResponse.verify|verify} messages.
         * @param message LoginResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        static encodeDelimited(message: mcs_proto.LoginResponse.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a LoginResponse message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns {mcs_proto.LoginResponse & mcs_proto.LoginResponse.$Shape} LoginResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): mcs_proto.LoginResponse & mcs_proto.LoginResponse.$Shape;

        /**
         * Decodes a LoginResponse message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns {mcs_proto.LoginResponse & mcs_proto.LoginResponse.$Shape} LoginResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): mcs_proto.LoginResponse & mcs_proto.LoginResponse.$Shape;

        /**
         * Verifies a LoginResponse message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a LoginResponse message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns LoginResponse
         */
        static fromObject(object: { [k: string]: any }): mcs_proto.LoginResponse;

        /**
         * Creates a plain object from a LoginResponse message. Also converts values to other types if specified.
         * @param message LoginResponse
         * @param [options] Conversion options
         * @returns Plain object
         */
        static toObject(message: mcs_proto.LoginResponse, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this LoginResponse to JSON.
         * @returns JSON object
         */
        toJSON(): { [k: string]: any };

        /**
         * Gets the type url for LoginResponse
         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
         * @returns The type url
         */
        static getTypeUrl(prefix?: string): string;
    }

    namespace LoginResponse {

        /** Properties of a LoginResponse. */
        interface $Properties {

            /** LoginResponse id */
            id: string;

            /** LoginResponse jid */
            jid?: (string|null);

            /** LoginResponse error */
            error?: (mcs_proto.ErrorInfo.$Properties|null);

            /** LoginResponse setting */
            setting?: (mcs_proto.Setting.$Properties[]|null);

            /** LoginResponse streamId */
            streamId?: (number|null);

            /** LoginResponse lastStreamIdReceived */
            lastStreamIdReceived?: (number|null);

            /** LoginResponse heartbeatConfig */
            heartbeatConfig?: (mcs_proto.HeartbeatConfig.$Properties|null);

            /** LoginResponse serverTimestamp */
            serverTimestamp?: (number|Long|null);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];
        }

        /** Shape of a LoginResponse. */
        type $Shape = mcs_proto.LoginResponse.$Properties;
    }

    /**
     * Properties of a StreamErrorStanza.
     * @deprecated Use mcs_proto.StreamErrorStanza.$Properties instead.
     */
    interface IStreamErrorStanza extends mcs_proto.StreamErrorStanza.$Properties {
    }

    /** Represents a StreamErrorStanza. */
    class StreamErrorStanza {

        /**
         * Constructs a new StreamErrorStanza.
         * @param [properties] Properties to set
         */
        constructor(properties?: mcs_proto.StreamErrorStanza.$Properties);

        /** Unknown fields preserved while decoding when enabled */
        $unknowns?: Uint8Array[];

        /** StreamErrorStanza type. */
        type: string;

        /** StreamErrorStanza text. */
        text: string;

        /**
         * Creates a new StreamErrorStanza instance using the specified properties.
         * @param [properties] Properties to set
         * @returns StreamErrorStanza instance
         */
        static create(properties: mcs_proto.StreamErrorStanza.$Shape): mcs_proto.StreamErrorStanza & mcs_proto.StreamErrorStanza.$Shape;
        static create(properties?: mcs_proto.StreamErrorStanza.$Properties): mcs_proto.StreamErrorStanza;

        /**
         * Encodes the specified StreamErrorStanza message. Does not implicitly {@link mcs_proto.StreamErrorStanza.verify|verify} messages.
         * @param message StreamErrorStanza message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        static encode(message: mcs_proto.StreamErrorStanza.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified StreamErrorStanza message, length delimited. Does not implicitly {@link mcs_proto.StreamErrorStanza.verify|verify} messages.
         * @param message StreamErrorStanza message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        static encodeDelimited(message: mcs_proto.StreamErrorStanza.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a StreamErrorStanza message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns {mcs_proto.StreamErrorStanza & mcs_proto.StreamErrorStanza.$Shape} StreamErrorStanza
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): mcs_proto.StreamErrorStanza & mcs_proto.StreamErrorStanza.$Shape;

        /**
         * Decodes a StreamErrorStanza message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns {mcs_proto.StreamErrorStanza & mcs_proto.StreamErrorStanza.$Shape} StreamErrorStanza
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): mcs_proto.StreamErrorStanza & mcs_proto.StreamErrorStanza.$Shape;

        /**
         * Verifies a StreamErrorStanza message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a StreamErrorStanza message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns StreamErrorStanza
         */
        static fromObject(object: { [k: string]: any }): mcs_proto.StreamErrorStanza;

        /**
         * Creates a plain object from a StreamErrorStanza message. Also converts values to other types if specified.
         * @param message StreamErrorStanza
         * @param [options] Conversion options
         * @returns Plain object
         */
        static toObject(message: mcs_proto.StreamErrorStanza, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this StreamErrorStanza to JSON.
         * @returns JSON object
         */
        toJSON(): { [k: string]: any };

        /**
         * Gets the type url for StreamErrorStanza
         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
         * @returns The type url
         */
        static getTypeUrl(prefix?: string): string;
    }

    namespace StreamErrorStanza {

        /** Properties of a StreamErrorStanza. */
        interface $Properties {

            /** StreamErrorStanza type */
            type: string;

            /** StreamErrorStanza text */
            text?: (string|null);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];
        }

        /** Shape of a StreamErrorStanza. */
        type $Shape = mcs_proto.StreamErrorStanza.$Properties;
    }

    /**
     * Properties of a Close.
     * @deprecated Use mcs_proto.Close.$Properties instead.
     */
    interface IClose extends mcs_proto.Close.$Properties {
    }

    /** TAG: 4 */
    class Close {

        /**
         * Constructs a new Close.
         * @param [properties] Properties to set
         */
        constructor(properties?: mcs_proto.Close.$Properties);

        /** Unknown fields preserved while decoding when enabled */
        $unknowns?: Uint8Array[];

        /**
         * Creates a new Close instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Close instance
         */
        static create(properties: mcs_proto.Close.$Shape): mcs_proto.Close & mcs_proto.Close.$Shape;
        static create(properties?: mcs_proto.Close.$Properties): mcs_proto.Close;

        /**
         * Encodes the specified Close message. Does not implicitly {@link mcs_proto.Close.verify|verify} messages.
         * @param message Close message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        static encode(message: mcs_proto.Close.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified Close message, length delimited. Does not implicitly {@link mcs_proto.Close.verify|verify} messages.
         * @param message Close message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        static encodeDelimited(message: mcs_proto.Close.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a Close message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns {mcs_proto.Close & mcs_proto.Close.$Shape} Close
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): mcs_proto.Close & mcs_proto.Close.$Shape;

        /**
         * Decodes a Close message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns {mcs_proto.Close & mcs_proto.Close.$Shape} Close
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): mcs_proto.Close & mcs_proto.Close.$Shape;

        /**
         * Verifies a Close message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a Close message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Close
         */
        static fromObject(object: { [k: string]: any }): mcs_proto.Close;

        /**
         * Creates a plain object from a Close message. Also converts values to other types if specified.
         * @param message Close
         * @param [options] Conversion options
         * @returns Plain object
         */
        static toObject(message: mcs_proto.Close, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this Close to JSON.
         * @returns JSON object
         */
        toJSON(): { [k: string]: any };

        /**
         * Gets the type url for Close
         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
         * @returns The type url
         */
        static getTypeUrl(prefix?: string): string;
    }

    namespace Close {

        /** Properties of a Close. */
        interface $Properties {

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];
        }

        /** Shape of a Close. */
        type $Shape = mcs_proto.Close.$Properties;
    }

    /**
     * Properties of an Extension.
     * @deprecated Use mcs_proto.Extension.$Properties instead.
     */
    interface IExtension extends mcs_proto.Extension.$Properties {
    }

    /** Represents an Extension. */
    class Extension {

        /**
         * Constructs a new Extension.
         * @param [properties] Properties to set
         */
        constructor(properties?: mcs_proto.Extension.$Properties);

        /** Unknown fields preserved while decoding when enabled */
        $unknowns?: Uint8Array[];

        /** Extension id. */
        id: number;

        /** Extension data. */
        data: Uint8Array;

        /**
         * Creates a new Extension instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Extension instance
         */
        static create(properties: mcs_proto.Extension.$Shape): mcs_proto.Extension & mcs_proto.Extension.$Shape;
        static create(properties?: mcs_proto.Extension.$Properties): mcs_proto.Extension;

        /**
         * Encodes the specified Extension message. Does not implicitly {@link mcs_proto.Extension.verify|verify} messages.
         * @param message Extension message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        static encode(message: mcs_proto.Extension.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified Extension message, length delimited. Does not implicitly {@link mcs_proto.Extension.verify|verify} messages.
         * @param message Extension message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        static encodeDelimited(message: mcs_proto.Extension.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes an Extension message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns {mcs_proto.Extension & mcs_proto.Extension.$Shape} Extension
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): mcs_proto.Extension & mcs_proto.Extension.$Shape;

        /**
         * Decodes an Extension message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns {mcs_proto.Extension & mcs_proto.Extension.$Shape} Extension
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): mcs_proto.Extension & mcs_proto.Extension.$Shape;

        /**
         * Verifies an Extension message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates an Extension message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Extension
         */
        static fromObject(object: { [k: string]: any }): mcs_proto.Extension;

        /**
         * Creates a plain object from an Extension message. Also converts values to other types if specified.
         * @param message Extension
         * @param [options] Conversion options
         * @returns Plain object
         */
        static toObject(message: mcs_proto.Extension, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this Extension to JSON.
         * @returns JSON object
         */
        toJSON(): { [k: string]: any };

        /**
         * Gets the type url for Extension
         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
         * @returns The type url
         */
        static getTypeUrl(prefix?: string): string;
    }

    namespace Extension {

        /** Properties of an Extension. */
        interface $Properties {

            /** Extension id */
            id: number;

            /** Extension data */
            data: Uint8Array;

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];
        }

        /** Shape of an Extension. */
        type $Shape = mcs_proto.Extension.$Properties;
    }

    /**
     * Properties of an IqStanza.
     * @deprecated Use mcs_proto.IqStanza.$Properties instead.
     */
    interface IIqStanza extends mcs_proto.IqStanza.$Properties {
    }

    /**
     * TAG: 7
     * IqRequest must contain a single extension.  IqResponse may contain 0 or 1
     * extensions.
     */
    class IqStanza {

        /**
         * Constructs a new IqStanza.
         * @param [properties] Properties to set
         */
        constructor(properties?: mcs_proto.IqStanza.$Properties);

        /** Unknown fields preserved while decoding when enabled */
        $unknowns?: Uint8Array[];

        /** IqStanza rmqId. */
        rmqId: (number|Long);

        /** IqStanza type. */
        type: mcs_proto.IqStanza.IqType;

        /** IqStanza id. */
        id: string;

        /** IqStanza from. */
        from: string;

        /** IqStanza to. */
        to: string;

        /** IqStanza error. */
        error?: (mcs_proto.ErrorInfo.$Properties|null);

        /** IqStanza extension. */
        extension?: (mcs_proto.Extension.$Properties|null);

        /** IqStanza persistentId. */
        persistentId: string;

        /** IqStanza streamId. */
        streamId: number;

        /** IqStanza lastStreamIdReceived. */
        lastStreamIdReceived: number;

        /** IqStanza accountId. */
        accountId: (number|Long);

        /** IqStanza status. */
        status: (number|Long);

        /**
         * Creates a new IqStanza instance using the specified properties.
         * @param [properties] Properties to set
         * @returns IqStanza instance
         */
        static create(properties: mcs_proto.IqStanza.$Shape): mcs_proto.IqStanza & mcs_proto.IqStanza.$Shape;
        static create(properties?: mcs_proto.IqStanza.$Properties): mcs_proto.IqStanza;

        /**
         * Encodes the specified IqStanza message. Does not implicitly {@link mcs_proto.IqStanza.verify|verify} messages.
         * @param message IqStanza message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        static encode(message: mcs_proto.IqStanza.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified IqStanza message, length delimited. Does not implicitly {@link mcs_proto.IqStanza.verify|verify} messages.
         * @param message IqStanza message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        static encodeDelimited(message: mcs_proto.IqStanza.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes an IqStanza message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns {mcs_proto.IqStanza & mcs_proto.IqStanza.$Shape} IqStanza
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): mcs_proto.IqStanza & mcs_proto.IqStanza.$Shape;

        /**
         * Decodes an IqStanza message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns {mcs_proto.IqStanza & mcs_proto.IqStanza.$Shape} IqStanza
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): mcs_proto.IqStanza & mcs_proto.IqStanza.$Shape;

        /**
         * Verifies an IqStanza message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates an IqStanza message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns IqStanza
         */
        static fromObject(object: { [k: string]: any }): mcs_proto.IqStanza;

        /**
         * Creates a plain object from an IqStanza message. Also converts values to other types if specified.
         * @param message IqStanza
         * @param [options] Conversion options
         * @returns Plain object
         */
        static toObject(message: mcs_proto.IqStanza, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this IqStanza to JSON.
         * @returns JSON object
         */
        toJSON(): { [k: string]: any };

        /**
         * Gets the type url for IqStanza
         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
         * @returns The type url
         */
        static getTypeUrl(prefix?: string): string;
    }

    namespace IqStanza {

        /** Properties of an IqStanza. */
        interface $Properties {

            /** IqStanza rmqId */
            rmqId?: (number|Long|null);

            /** IqStanza type */
            type: mcs_proto.IqStanza.IqType;

            /** IqStanza id */
            id: string;

            /** IqStanza from */
            from?: (string|null);

            /** IqStanza to */
            to?: (string|null);

            /** IqStanza error */
            error?: (mcs_proto.ErrorInfo.$Properties|null);

            /** IqStanza extension */
            extension?: (mcs_proto.Extension.$Properties|null);

            /** IqStanza persistentId */
            persistentId?: (string|null);

            /** IqStanza streamId */
            streamId?: (number|null);

            /** IqStanza lastStreamIdReceived */
            lastStreamIdReceived?: (number|null);

            /** IqStanza accountId */
            accountId?: (number|Long|null);

            /** IqStanza status */
            status?: (number|Long|null);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];
        }

        /** Shape of an IqStanza. */
        type $Shape = mcs_proto.IqStanza.$Properties;

        /** IqType enum. */
        enum IqType {

            /** GET value */
            GET = 0,

            /** SET value */
            SET = 1,

            /** RESULT value */
            RESULT = 2,

            /** IQ_ERROR value */
            IQ_ERROR = 3
        }
    }

    /**
     * Properties of an AppData.
     * @deprecated Use mcs_proto.AppData.$Properties instead.
     */
    interface IAppData extends mcs_proto.AppData.$Properties {
    }

    /** Represents an AppData. */
    class AppData {

        /**
         * Constructs a new AppData.
         * @param [properties] Properties to set
         */
        constructor(properties?: mcs_proto.AppData.$Properties);

        /** Unknown fields preserved while decoding when enabled */
        $unknowns?: Uint8Array[];

        /** AppData key. */
        key: string;

        /** AppData value. */
        value: string;

        /**
         * Creates a new AppData instance using the specified properties.
         * @param [properties] Properties to set
         * @returns AppData instance
         */
        static create(properties: mcs_proto.AppData.$Shape): mcs_proto.AppData & mcs_proto.AppData.$Shape;
        static create(properties?: mcs_proto.AppData.$Properties): mcs_proto.AppData;

        /**
         * Encodes the specified AppData message. Does not implicitly {@link mcs_proto.AppData.verify|verify} messages.
         * @param message AppData message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        static encode(message: mcs_proto.AppData.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified AppData message, length delimited. Does not implicitly {@link mcs_proto.AppData.verify|verify} messages.
         * @param message AppData message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        static encodeDelimited(message: mcs_proto.AppData.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes an AppData message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns {mcs_proto.AppData & mcs_proto.AppData.$Shape} AppData
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): mcs_proto.AppData & mcs_proto.AppData.$Shape;

        /**
         * Decodes an AppData message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns {mcs_proto.AppData & mcs_proto.AppData.$Shape} AppData
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): mcs_proto.AppData & mcs_proto.AppData.$Shape;

        /**
         * Verifies an AppData message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates an AppData message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns AppData
         */
        static fromObject(object: { [k: string]: any }): mcs_proto.AppData;

        /**
         * Creates a plain object from an AppData message. Also converts values to other types if specified.
         * @param message AppData
         * @param [options] Conversion options
         * @returns Plain object
         */
        static toObject(message: mcs_proto.AppData, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this AppData to JSON.
         * @returns JSON object
         */
        toJSON(): { [k: string]: any };

        /**
         * Gets the type url for AppData
         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
         * @returns The type url
         */
        static getTypeUrl(prefix?: string): string;
    }

    namespace AppData {

        /** Properties of an AppData. */
        interface $Properties {

            /** AppData key */
            key: string;

            /** AppData value */
            value: string;

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];
        }

        /** Shape of an AppData. */
        type $Shape = mcs_proto.AppData.$Properties;
    }

    /**
     * Properties of a DataMessageStanza.
     * @deprecated Use mcs_proto.DataMessageStanza.$Properties instead.
     */
    interface IDataMessageStanza extends mcs_proto.DataMessageStanza.$Properties {
    }

    /** TAG: 8 */
    class DataMessageStanza {

        /**
         * Constructs a new DataMessageStanza.
         * @param [properties] Properties to set
         */
        constructor(properties?: mcs_proto.DataMessageStanza.$Properties);

        /** Unknown fields preserved while decoding when enabled */
        $unknowns?: Uint8Array[];

        /** DataMessageStanza id. */
        id: string;

        /** DataMessageStanza from. */
        from: string;

        /** DataMessageStanza to. */
        to: string;

        /** DataMessageStanza category. */
        category: string;

        /** DataMessageStanza token. */
        token: string;

        /** DataMessageStanza appData. */
        appData: mcs_proto.AppData.$Properties[];

        /** DataMessageStanza fromTrustedServer. */
        fromTrustedServer: boolean;

        /** DataMessageStanza persistentId. */
        persistentId: string;

        /** DataMessageStanza streamId. */
        streamId: number;

        /** DataMessageStanza lastStreamIdReceived. */
        lastStreamIdReceived: number;

        /** DataMessageStanza regId. */
        regId: string;

        /** DataMessageStanza deviceUserId. */
        deviceUserId: (number|Long);

        /** DataMessageStanza ttl. */
        ttl: number;

        /** DataMessageStanza sent. */
        sent: (number|Long);

        /** DataMessageStanza queued. */
        queued: number;

        /** DataMessageStanza status. */
        status: (number|Long);

        /** DataMessageStanza rawData. */
        rawData: Uint8Array;

        /** DataMessageStanza immediateAck. */
        immediateAck: boolean;

        /**
         * Creates a new DataMessageStanza instance using the specified properties.
         * @param [properties] Properties to set
         * @returns DataMessageStanza instance
         */
        static create(properties: mcs_proto.DataMessageStanza.$Shape): mcs_proto.DataMessageStanza & mcs_proto.DataMessageStanza.$Shape;
        static create(properties?: mcs_proto.DataMessageStanza.$Properties): mcs_proto.DataMessageStanza;

        /**
         * Encodes the specified DataMessageStanza message. Does not implicitly {@link mcs_proto.DataMessageStanza.verify|verify} messages.
         * @param message DataMessageStanza message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        static encode(message: mcs_proto.DataMessageStanza.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified DataMessageStanza message, length delimited. Does not implicitly {@link mcs_proto.DataMessageStanza.verify|verify} messages.
         * @param message DataMessageStanza message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        static encodeDelimited(message: mcs_proto.DataMessageStanza.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a DataMessageStanza message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns {mcs_proto.DataMessageStanza & mcs_proto.DataMessageStanza.$Shape} DataMessageStanza
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): mcs_proto.DataMessageStanza & mcs_proto.DataMessageStanza.$Shape;

        /**
         * Decodes a DataMessageStanza message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns {mcs_proto.DataMessageStanza & mcs_proto.DataMessageStanza.$Shape} DataMessageStanza
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): mcs_proto.DataMessageStanza & mcs_proto.DataMessageStanza.$Shape;

        /**
         * Verifies a DataMessageStanza message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a DataMessageStanza message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns DataMessageStanza
         */
        static fromObject(object: { [k: string]: any }): mcs_proto.DataMessageStanza;

        /**
         * Creates a plain object from a DataMessageStanza message. Also converts values to other types if specified.
         * @param message DataMessageStanza
         * @param [options] Conversion options
         * @returns Plain object
         */
        static toObject(message: mcs_proto.DataMessageStanza, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this DataMessageStanza to JSON.
         * @returns JSON object
         */
        toJSON(): { [k: string]: any };

        /**
         * Gets the type url for DataMessageStanza
         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
         * @returns The type url
         */
        static getTypeUrl(prefix?: string): string;
    }

    namespace DataMessageStanza {

        /** Properties of a DataMessageStanza. */
        interface $Properties {

            /** DataMessageStanza id */
            id?: (string|null);

            /** DataMessageStanza from */
            from: string;

            /** DataMessageStanza to */
            to?: (string|null);

            /** DataMessageStanza category */
            category: string;

            /** DataMessageStanza token */
            token?: (string|null);

            /** DataMessageStanza appData */
            appData?: (mcs_proto.AppData.$Properties[]|null);

            /** DataMessageStanza fromTrustedServer */
            fromTrustedServer?: (boolean|null);

            /** DataMessageStanza persistentId */
            persistentId?: (string|null);

            /** DataMessageStanza streamId */
            streamId?: (number|null);

            /** DataMessageStanza lastStreamIdReceived */
            lastStreamIdReceived?: (number|null);

            /** DataMessageStanza regId */
            regId?: (string|null);

            /** DataMessageStanza deviceUserId */
            deviceUserId?: (number|Long|null);

            /** DataMessageStanza ttl */
            ttl?: (number|null);

            /** DataMessageStanza sent */
            sent?: (number|Long|null);

            /** DataMessageStanza queued */
            queued?: (number|null);

            /** DataMessageStanza status */
            status?: (number|Long|null);

            /** DataMessageStanza rawData */
            rawData?: (Uint8Array|null);

            /** DataMessageStanza immediateAck */
            immediateAck?: (boolean|null);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];
        }

        /** Shape of a DataMessageStanza. */
        type $Shape = mcs_proto.DataMessageStanza.$Properties;
    }

    /**
     * Properties of a StreamAck.
     * @deprecated Use mcs_proto.StreamAck.$Properties instead.
     */
    interface IStreamAck extends mcs_proto.StreamAck.$Properties {
    }

    /**
     * Included in IQ with ID 13, sent from client or server after 10 unconfirmed
     * messages.
     */
    class StreamAck {

        /**
         * Constructs a new StreamAck.
         * @param [properties] Properties to set
         */
        constructor(properties?: mcs_proto.StreamAck.$Properties);

        /** Unknown fields preserved while decoding when enabled */
        $unknowns?: Uint8Array[];

        /**
         * Creates a new StreamAck instance using the specified properties.
         * @param [properties] Properties to set
         * @returns StreamAck instance
         */
        static create(properties: mcs_proto.StreamAck.$Shape): mcs_proto.StreamAck & mcs_proto.StreamAck.$Shape;
        static create(properties?: mcs_proto.StreamAck.$Properties): mcs_proto.StreamAck;

        /**
         * Encodes the specified StreamAck message. Does not implicitly {@link mcs_proto.StreamAck.verify|verify} messages.
         * @param message StreamAck message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        static encode(message: mcs_proto.StreamAck.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified StreamAck message, length delimited. Does not implicitly {@link mcs_proto.StreamAck.verify|verify} messages.
         * @param message StreamAck message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        static encodeDelimited(message: mcs_proto.StreamAck.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a StreamAck message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns {mcs_proto.StreamAck & mcs_proto.StreamAck.$Shape} StreamAck
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): mcs_proto.StreamAck & mcs_proto.StreamAck.$Shape;

        /**
         * Decodes a StreamAck message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns {mcs_proto.StreamAck & mcs_proto.StreamAck.$Shape} StreamAck
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): mcs_proto.StreamAck & mcs_proto.StreamAck.$Shape;

        /**
         * Verifies a StreamAck message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a StreamAck message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns StreamAck
         */
        static fromObject(object: { [k: string]: any }): mcs_proto.StreamAck;

        /**
         * Creates a plain object from a StreamAck message. Also converts values to other types if specified.
         * @param message StreamAck
         * @param [options] Conversion options
         * @returns Plain object
         */
        static toObject(message: mcs_proto.StreamAck, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this StreamAck to JSON.
         * @returns JSON object
         */
        toJSON(): { [k: string]: any };

        /**
         * Gets the type url for StreamAck
         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
         * @returns The type url
         */
        static getTypeUrl(prefix?: string): string;
    }

    namespace StreamAck {

        /** Properties of a StreamAck. */
        interface $Properties {

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];
        }

        /** Shape of a StreamAck. */
        type $Shape = mcs_proto.StreamAck.$Properties;
    }

    /**
     * Properties of a SelectiveAck.
     * @deprecated Use mcs_proto.SelectiveAck.$Properties instead.
     */
    interface ISelectiveAck extends mcs_proto.SelectiveAck.$Properties {
    }

    /** Included in IQ sent after LoginResponse from server with ID 12. */
    class SelectiveAck {

        /**
         * Constructs a new SelectiveAck.
         * @param [properties] Properties to set
         */
        constructor(properties?: mcs_proto.SelectiveAck.$Properties);

        /** Unknown fields preserved while decoding when enabled */
        $unknowns?: Uint8Array[];

        /** SelectiveAck id. */
        id: string[];

        /**
         * Creates a new SelectiveAck instance using the specified properties.
         * @param [properties] Properties to set
         * @returns SelectiveAck instance
         */
        static create(properties: mcs_proto.SelectiveAck.$Shape): mcs_proto.SelectiveAck & mcs_proto.SelectiveAck.$Shape;
        static create(properties?: mcs_proto.SelectiveAck.$Properties): mcs_proto.SelectiveAck;

        /**
         * Encodes the specified SelectiveAck message. Does not implicitly {@link mcs_proto.SelectiveAck.verify|verify} messages.
         * @param message SelectiveAck message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        static encode(message: mcs_proto.SelectiveAck.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified SelectiveAck message, length delimited. Does not implicitly {@link mcs_proto.SelectiveAck.verify|verify} messages.
         * @param message SelectiveAck message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        static encodeDelimited(message: mcs_proto.SelectiveAck.$Properties, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a SelectiveAck message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns {mcs_proto.SelectiveAck & mcs_proto.SelectiveAck.$Shape} SelectiveAck
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): mcs_proto.SelectiveAck & mcs_proto.SelectiveAck.$Shape;

        /**
         * Decodes a SelectiveAck message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns {mcs_proto.SelectiveAck & mcs_proto.SelectiveAck.$Shape} SelectiveAck
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): mcs_proto.SelectiveAck & mcs_proto.SelectiveAck.$Shape;

        /**
         * Verifies a SelectiveAck message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a SelectiveAck message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns SelectiveAck
         */
        static fromObject(object: { [k: string]: any }): mcs_proto.SelectiveAck;

        /**
         * Creates a plain object from a SelectiveAck message. Also converts values to other types if specified.
         * @param message SelectiveAck
         * @param [options] Conversion options
         * @returns Plain object
         */
        static toObject(message: mcs_proto.SelectiveAck, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this SelectiveAck to JSON.
         * @returns JSON object
         */
        toJSON(): { [k: string]: any };

        /**
         * Gets the type url for SelectiveAck
         * @param [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
         * @returns The type url
         */
        static getTypeUrl(prefix?: string): string;
    }

    namespace SelectiveAck {

        /** Properties of a SelectiveAck. */
        interface $Properties {

            /** SelectiveAck id */
            id?: (string[]|null);

            /** Unknown fields preserved while decoding when enabled */
            $unknowns?: Uint8Array[];
        }

        /** Shape of a SelectiveAck. */
        type $Shape = mcs_proto.SelectiveAck.$Properties;
    }
}
