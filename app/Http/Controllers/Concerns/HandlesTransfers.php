<?php

namespace App\Http\Controllers\Concerns;

use App\Enums\IssueReason;
use App\Models\Transfer;
use App\Models\TransferLine;
use App\Models\User;
use App\Services\Transfers;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * What the receiving end of a transfer does, from the till's Stock-in tab or from Inventory: receive it in
 * full or line by line, cancel its own request, and flag an issue on a line.
 */
trait HandlesTransfers
{
    /**
     * Who is acting: the till's staff member, or the signed-in Inventory user.
     */
    abstract protected function actor(): User;

    abstract protected function authorizeActor(string $ability, mixed $arguments): void;

    /**
     * Receive every line still on its way.
     */
    public function receive(Transfer $transfer, Transfers $transfers): RedirectResponse
    {
        $this->authorizeActor('receive', $transfer);

        $transfers->receive($transfer, $this->actor());

        return back();
    }

    public function receiveLine(Transfer $transfer, TransferLine $line, Transfers $transfers): RedirectResponse
    {
        $this->authorizeActor('receive', $transfer);

        $transfers->receive($transfer, $this->actor(), $line);

        return back();
    }

    /**
     * The requester withdraws its request before it is sent.
     */
    public function cancel(Transfer $transfer, Transfers $transfers): RedirectResponse
    {
        $this->authorizeActor('receive', $transfer);

        $transfers->cancel($transfer, $this->actor());

        return back();
    }

    /**
     * Flag what went wrong with a line, such as a short or damaged delivery.
     */
    public function flag(Request $request, Transfer $transfer, TransferLine $line, Transfers $transfers): RedirectResponse
    {
        $this->authorizeActor('flag', $transfer);

        $data = $request->validate([
            'reason' => ['required', Rule::enum(IssueReason::class)],
            'note' => ['nullable', 'string', 'max:300'],
        ]);

        $transfers->flag($line, IssueReason::from($data['reason']), $data['note'] ?? null, $this->actor());

        return back();
    }

    /**
     * @return array{from_branch_id: int, lines: list<array{stock_item_id: int, qty: float}>}
     */
    protected function validatedRequisition(Request $request): array
    {
        return $request->validate([
            'from_branch_id' => ['required', 'integer', 'exists:branches,id'],
            'lines' => ['required', 'array', 'min:1', 'max:80'],
            'lines.*.stock_item_id' => ['required', 'integer', 'distinct', 'exists:stock_items,id'],
            'lines.*.qty' => ['required', 'numeric', 'gt:0', 'max:100000'],
        ], [
            'lines.required' => 'Add at least one item to request.',
        ]);
    }

    /**
     * @param  array{lines: list<array{stock_item_id: int, qty: float}>}  $data
     * @return array<int, float>
     */
    protected function requestedLines(array $data): array
    {
        return collect($data['lines'])->mapWithKeys(fn (array $line) => [(int) $line['stock_item_id'] => (float) $line['qty']])->all();
    }
}
