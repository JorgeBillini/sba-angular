import {Injectable, InjectionToken, Optional, Inject} from "@angular/core";
import {IntlService} from "@sinequa/core/intl";
import {Utils, FieldValue} from "@sinequa/core/base";
import {AppServiceHelpers} from "./app-service-helpers";
import {CCColumn} from "@sinequa/core/web-services";

/**
 * Describes a value item object that includes a {@link FieldValue} and an optional display value
 * to override standard field value formatting
 */
export interface ValueItem {
    value: FieldValue;
    display?: string;
}

/**
 * Describes options for the {@link FormatService} that can be set by providing the `FORMAT_OPTIONS`
 * injection token
 */
export interface FormatOptions {
    /**
     * A callback to provide custom behavior for the [FormatService.formatValue]{@link FormatService#formatValue} method.
     * The formatter is defined in the column's formatter property. Return a non-undefined value to prevent the default behavior
     */
    formatValue?: (value: FieldValue, display: string, column?: CCColumn) => string | undefined;
    /**
     * A callback to provide custom behavior for the [FormatService.transformValue]{@link FormatService#transformValue} method.
     * Multiple transforms can be defined on a column - the callback is called per defined transform. Return a non-undefined value to
     * prevent the default behavior
     */
    transformValue?: (transform: string, value: string, column?: CCColumn) => string | undefined;
    /**
     * A callback to provide custom behavior for the [FormatService.formatFieldValue]{@link FormatService#formatFieldValue} method.
     * By default, this method calls the `formatValue` and `transformValue` methods. Return a non-undefined value to prevent the default
     * behavior
     */
    formatFieldValue?: (valueItem: ValueItem | FieldValue, column?: CCColumn) => string | undefined;
    /**
     * A callback to provide custom behavior for the [FormatService.parseValue]{@link FormatService#parseValue} method. This method is
     * used to interpret values entered in fielded search expressions. Return a non-undefined value to prevent the default behavior
     */
    parseValue?: (value: string, parser: string) => string | undefined;
}

/**
 * The injection token that can be provided to set {@link FormatOptions} for the {@link FormatService}
 */
export const FORMAT_OPTIONS = new InjectionToken<FormatOptions>("FORMAT_OPTIONS");

/**
 * This service provides methods for locale-sensitive formatting and parsing of values that can be found in
 * Sinequa search results. The built-in functionality can be extended by providing the {@link FORMAT_OPTIONS} injection token
 */
@Injectable({
    providedIn: "root"
})
export class FormatService {
    constructor(
        @Optional() @Inject(FORMAT_OPTIONS) public options: FormatOptions,
        public intlService: IntlService) {
        if (!this.options) {
            this.options = {};
        }
    }

    private isValueItem(valueItem: ValueItem | FieldValue): valueItem is ValueItem {
        if (Utils.isObject(valueItem) && !Utils.isDate(valueItem) && !Utils.isArray(valueItem)) {
            return true;
        }
        return false;
    }

    private getValueAndDisplay(valueItem: ValueItem | FieldValue): [FieldValue, string] {
        let value: FieldValue;
        let display: string;
        if (this.isValueItem(valueItem)) {
            value = valueItem.value;
            display = valueItem.display || "";
        }
        else {
            value = valueItem;
            display = "";
        }
        return [value, display];
    }

    /**
     * Return the display equivalent of a Sinequa language specifier (`en`, `fr`, ...).
     * The display values are defined in the {@link IntlModule} message files
     *
     * @param value A value containing a Sinequa language specifier
     */
    formatLanguage(value: FieldValue): string {
        return this.intlService.formatMessage(`msg#language.${Utils.toLowerCase(value + "")}`);
    }

    /**
     * Return the display equivalent of a size value. The units (`kb`, `mb`, ...) are defined
     * in the {@link IntlModule} message files
     *
     * @param size A memory size in bytes
     */
    formatMemorySize(size: number): string {
        const kiloBytes: number = size / 1024;
        const megaBytes: number = kiloBytes / 1024;
        const gigaBytes: number = megaBytes / 1024;
        const teraBytes: number = gigaBytes / 1024;
        const petaBytes: number = teraBytes / 1024;

        let messageKey = "msg#system.memorySize.bytes";
        const params: any = { value: size };
        if (Math.abs(petaBytes) >= 1) {
            messageKey = "msg#system.memorySize.pb";
            params.value = petaBytes;
        }
        else if (Math.abs(teraBytes) >= 1) {
            messageKey = "msg#system.memorySize.tb";
            params.value = teraBytes;
        }
        else if (Math.abs(gigaBytes) >= 1) {
            messageKey = "msg#system.memorySize.gb";
            params.value = gigaBytes;
        }
        else if (Math.abs(megaBytes) >= 1) {
            messageKey = "msg#system.memorySize.mb";
            params.value = megaBytes;
        }
        else if (Math.abs(kiloBytes) >= 1) {
            messageKey = "msg#system.memorySize.kb";
            params.value = kiloBytes;
        }
        return this.intlService.formatMessage(messageKey, params);
    }

    /**
     * Format a value for display according to the passed `column`. Formatters
     * can be defined in the column's configuration to provide domain-specific
     * formatting. The standard formatters are `language` and `memorysize`.
     * Custom transformers can be specified by providing the {@link FORMAT_OPTIONS}
     * injection token
     *
     * @param valueItem The value to format
     * @param column The column associated with the value
     */
    formatValue(valueItem: ValueItem | FieldValue, column?: CCColumn): string {
        let [value, display] = this.getValueAndDisplay(valueItem);
        const ret = this.options.formatValue ? this.options.formatValue(value, display, column) : undefined;
        if (ret !== undefined) {
            return ret;
        }
        if (column && column.formatter) {
            switch (Utils.toLowerCase(column.formatter)) {
                case "language": return this.formatLanguage(value);
                case "memorysize":
                    if (Utils.isNumber(value)) {
                        return this.formatMemorySize(value);
                    }
                    break;
            }
        }
        if (display) {
            if (Utils.isDate(display)) { // ES-7785
                display = Utils.toSysDateStr(display);
            }
            return this.intlService.formatMessage(display, {value});
        }
        if (Utils.isNumber(value)) {
            const message = this.intlService.getMessage("msg#system.number");
            if (message) {
                return this.intlService.formatText(message, {value});
            }
            else {
                return this.intlService.formatNumber(value);
            }
        }
        if (Utils.isDate(value)) {
            if (column && !AppServiceHelpers.isDate(column)) { // ES-7785
                value = Utils.toSysDateStr(value);
            }
            else {
                const message = this.intlService.getMessage("msg#system.date");
                if (message) {
                    return this.intlService.formatText(message, {date: value, time: Utils.getTime(value)});
                }
                else {
                    let s = this.intlService.formatDate(value);
                    if (Utils.getTime(value) !== 0) {
                        s += ", " + this.intlService.formatTime(value);
                    }
                    return s;
                }
            }
        }
        if (Utils.isBoolean(value)) {
            const message = this.intlService.getMessage("msg#system.boolean");
            if (message) {
                return this.intlService.formatText(message, {value});
            }
            else {
                return value.toString();
            }
        }
        if (Utils.isArray(value)) {
            const joinValue: string[] = [];
            value.forEach(v => {
                if (joinValue.length > 0) {
                    joinValue.push(";");
                }
                if (!v) {
                    joinValue.push("<null>");
                }
                else if (Utils.isString(v)) {
                    joinValue.push(v);
                }
                else {
                    joinValue.push(v.display || v.value || "<null>");
                }
            });
            value = joinValue.join("");
        }
        if (!value) {
            return value;
        }
        return this.intlService.formatMessage(value);
    }

    /**
     * Transform a display value. Multiple transformers can be defined on a column and their calls are chained.
     * The standard formatters are `uppercase`, `upperfirst`, `lowercase`, `lowerfirst`, `startcase`, `kebabcase`,
     * `snakecase` and `camelcase`. Custom transformers can be specified by providing the {@link FORMAT_OPTIONS}
     * injection token
     *
     * @param value The value to transform
     * @param column The column associated with the value
     */
    transformValue(value: string, column?: CCColumn): string {
        const transforms = column ? Utils.split(column.transforms || "", ",") : undefined;
        if (!transforms || transforms.length === 0) {
            return value;
        }
        // transforms are composable
        for (const transform of transforms) {
            const ret = this.options.transformValue ? this.options.transformValue(transform, value, column) : undefined;
            if (ret !== undefined) {
                value = ret;
            }
            switch (Utils.toLowerCase(transform)) {
                case "uppercase": value = Utils.toUpperCase(value); break;
                case "upperfirst": value = Utils.toUpperFirst(value); break;
                case "lowercase": value = Utils.toLowerCase(value); break;
                case "lowerfirst": value = Utils.toLowerFirst(value); break;
                case "startcase": value = Utils.toStartCase(value); break;
                case "kebabcase": value = Utils.toKebabCase(value); break;
                case "snakecase": value = Utils.toSnakeCase(value); break;
                case "camelcase": value = Utils.toCamelCase(value); break;
            }
        }
        return value;
    }

    /**
     * Format a value item for display. This is the standard entry point for formatting a value.
     * By default, this method calls [formatValue]{@link #formatValue} and [transformValue]{@link #transformValue}.
     * Custom behavior can be specified by providing the {@link FORMAT_OPTIONS} injection token
     *
     * @param valueItem The value item to format
     * @param column The column associated with the value item
     */
    formatFieldValue(valueItem: ValueItem | FieldValue, column?: CCColumn): string {
        const ret = this.options.formatFieldValue ? this.options.formatFieldValue(valueItem, column) : undefined;
        if (ret !== undefined) {
            return ret;
        }
        let formattedValue = this.formatValue(valueItem, column);
        formattedValue = this.transformValue(formattedValue, column);
        return formattedValue;
    }

    /**
     * Parse an input value according to the passed `parser`. The standard parser is `memorysize`. Parsers
     * are configured in the {@link CCColumn} configuration. Custom parsers can be specified by providing
     * the {@link FORMAT_OPTIONS} injection token. The parsed value is returned as a string for processing
     * by the {@link ValidationModule}
     *
     * @param value The value to parse
     * @param parser The parser to use
     */
    parseValue(value: any, parser: string): string {
        if (Utils.isString(value)) {
            if (parser) {
                const ret = this.options.parseValue ? this.options.parseValue(value, parser) : undefined;
                if (ret !== undefined) {
                    return ret;
                }
                switch (Utils.toLowerCase(parser)) {
                    case "memorysize": {
                        return this.parseMemorySize(value) + "";
                    }
                }
            }
        }
        return value;
    }

    /**
     * Parse a size string using [Utils.toSize]{@link Utils#toSize}
     *
     * @param str The string to parse
     * @param _default The default value to return if the string cannot be parsed
     * @return The parsed size in bytes
     */
    parseMemorySize(str: string, _default = 0): number {
        return Utils.toSize(str, _default);
    }
}
