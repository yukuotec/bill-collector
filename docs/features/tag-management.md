# Tag Management System

## Overview

The expense tracker includes a flexible tag management system that allows users to add custom tags to transactions for enhanced organization and filtering capabilities. Tags provide an additional layer of categorization beyond the standard category system.

## Features

### Tag Creation and Management
- **Add tags**: Users can add multiple tags to any transaction
- **Remove tags**: Individual tags can be removed from transactions
- **Comma-separated input**: Tags are entered as comma-separated values in the transaction list
- **Tag chips**: Tags are displayed as interactive chips with remove buttons

### Tag Storage
- Tags are stored as JSON arrays in the `tags` column of the transactions table
- Each transaction can have zero or more tags
- Tags are preserved during imports, exports, and database operations

### Tag Filtering
- **Search integration**: Tags are included in the general search functionality
- **Filter by tags**: Future enhancement to allow direct tag filtering

## Implementation Details

### Database Schema
The `transactions` table includes a `tags` column:
```sql
tags TEXT  -- JSON array of strings, e.g., '["grocery", "weekly"]'
```

### Frontend Implementation
- **Editable tags**: Clicking on the tags cell in the transaction list opens an edit mode
- **Input field**: Tags are entered as comma-separated values
- **Tag chips**: Displayed as colored chips with × buttons for removal
- **Real-time updates**: Changes are saved immediately via IPC calls

### Backend Implementation
- **Add tag**: `addTransactionTag(id: string, tag: string)` - adds a tag to a transaction
- **Remove tag**: `removeTransactionTag(id: string, tag: string)` - removes a specific tag
- **Get tags**: `getTransactionTags(id: string)` - retrieves all tags for a transaction
- **Atomic operations**: Each tag operation is atomic and immediately persisted

### IPC Handlers
- `get-tags`: Retrieves all tags for a specific transaction
- `add-tag`: Adds a new tag to a transaction
- `remove-tag`: Removes a specific tag from a transaction

## User Interface

### Transaction List View
In the transaction list, the "标签" (Tags) column displays:
- **No tags**: Shows "-" when no tags exist
- **With tags**: Shows interactive tag chips with remove buttons
- **Edit mode**: Clicking opens a comma-separated input field

### Tag Chips
- **Visual design**: Colored background with white text
- **Remove button**: Small × button that removes the specific tag
- **Hover effects**: Visual feedback on hover and click

## Usage Examples

### Adding Tags
1. Navigate to the Transactions page
2. Find the transaction you want to tag
3. Click on the "标签" cell for that transaction
4. Enter tags separated by commas (e.g., "grocery, weekly, essential")
5. Press Enter or click outside to save

### Removing Tags
1. In the transaction list, locate the tag chip you want to remove
2. Click the × button on the tag chip
3. The tag is immediately removed and saved

### Bulk Operations
- Tags are preserved during CSV/Excel exports
- Tags are included in database backups
- Tags work with all existing filtering and search functionality

## Integration with Other Features

### Search
- Tags are included in the general search functionality
- Searching for a tag name will find all transactions with that tag

### Export
- Tags are included in both CSV and Excel exports
- In CSV format, tags appear as JSON arrays in the tags column

### CLI Support
- The CLI tool includes tag management capabilities
- Future enhancement: CLI commands for tag-based operations

## Future Enhancements

### Planned Features
- **Tag filtering**: Direct filtering by specific tags
- **Tag suggestions**: Auto-suggest existing tags during input
- **Tag statistics**: Dashboard showing most used tags
- **Tag colors**: Customizable colors for different tags
- **Tag groups**: Hierarchical tag organization

### Technical Improvements
- **Dedicated tags table**: For better performance with large datasets
- **Tag indexing**: Database indexes for faster tag queries
- **Tag validation**: Input validation and sanitization

## API Reference

### Frontend Methods
- `startEditTags(id: string, currentTags: string | null | undefined)`: Opens tag edit mode
- `saveTags(id: string)`: Saves edited tags to backend
- `handleRemoveTag(id: string, tag: string)`: Removes a specific tag

### Backend Methods
- `getTransactionTags(id: string)`: Returns array of tags for transaction
- `addTransactionTag(id: string, tag: string)`: Adds tag to transaction
- `removeTransactionTag(id: string, tag: string)`: Removes tag from transaction

### IPC Messages
- `get-tags`: `{ id: string }` → `string[]`
- `add-tag`: `{ id: string, tag: string }` → `boolean`
- `remove-tag`: `{ id: string, tag: string }` → `boolean`

## Best Practices

### Tag Naming
- Use consistent naming conventions
- Avoid special characters that might cause issues
- Keep tag names short and descriptive
- Use lowercase for consistency

### Tag Organization
- Create a personal tagging strategy
- Use tags for temporary or situational categorization
- Combine with categories for comprehensive organization
- Regularly review and clean up unused tags

## Troubleshooting

### Common Issues
- **Tags not saving**: Ensure you press Enter or click outside the input field
- **Special characters**: Some special characters may not display correctly
- **Performance**: Large numbers of tags per transaction may impact performance
- **Export formatting**: Tags appear as JSON in exports, which may require parsing

### Solutions
- **Refresh page**: If tags don't appear to save, refresh the page
- **Check console**: Browser console may show error messages
- **Database integrity**: Use backup/restore if tag data becomes corrupted
- **Contact support**: Report persistent issues through the issue tracker

## Related Documentation
- [Data Import](./data-import.md)
- [Transaction Management](./transaction-management.md)
- [Search and Filtering](./search-filtering.md)
- [Export Functionality](./export-functionality.md)