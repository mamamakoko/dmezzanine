<?php

namespace App\Http\Resources;

use App\Models\Transfer;
use App\Models\TransferLine;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Carbon;

/**
 * A transfer as the till's Stock-in tab and Inventory show it. Needs from, to, requestedBy and
 * lines.stockItem and lines.issue loaded.
 *
 * @mixin Transfer
 */
class TransferResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'no' => $this->number(),
            'kind' => $this->kind->label(),
            'from' => ['id' => $this->from_branch_id, 'name' => $this->from->name],
            'to' => ['id' => $this->to_branch_id, 'name' => $this->to->name],
            'status' => $this->status,
            'status_label' => $this->status->label(),
            'raised_at' => $this->created_at->toIso8601String(),
            'day' => Carbon::parse($this->created_at)->setTimezone(config('app.business_timezone'))->toDateString(),
            'by' => $this->requestedBy?->name,
            'lines' => $this->lines->map(fn (TransferLine $line) => [
                'id' => $line->id,
                'stock_item_id' => $line->stock_item_id,
                'name' => $line->stockItem->name,
                'sku' => $line->stockItem->sku,
                'qty' => (float) $line->qty,
                'unit' => $line->stockItem->unit,
                'received' => $line->received_at !== null,
                'issue' => $line->issue === null ? null : [
                    'reason' => $line->issue->reason,
                    'label' => $line->issue->reason->label(),
                    'note' => $line->issue->note,
                ],
            ])->all(),
        ];
    }
}
