import type { GoogleMapsListImportResult } from '@/api/trips';

export function googleMapsImportNotice(result: GoogleMapsListImportResult) {
  const imported = `${result.importedCount} place${result.importedCount === 1 ? '' : 's'}`;
  const skipped = result.skippedCount
    ? ` ${result.skippedCount} already existed or could not be read.`
    : '';

  return `Imported ${imported} from ${result.listName}.${skipped}`;
}
