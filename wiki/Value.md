# class `Value`

## Methods
### `asString` - Returns string - no need to explain
### `asBoolean` - Converts value into `boolean`
### `asNumber` - Converts value into `number`
### `asJSON` - Converts value into `JSON`
### `asConverted` - Converts value into its "best guess" type: `boolean`, `number`, parsed `JSON`, or the raw string if none of those match (an empty value stays an empty string)
### `getSource` - Identify value source as `static | default | remote `