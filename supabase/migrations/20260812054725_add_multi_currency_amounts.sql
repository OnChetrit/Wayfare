alter table public.schedule_items
  add column amount numeric(12, 2),
  add column currency text;

alter table public.schedule_items
  add constraint schedule_items_amount_nonnegative check (amount is null or amount >= 0),
  add constraint schedule_items_currency_code check (currency is null or char_length(currency) = 3),
  add constraint schedule_items_amount_currency_pair check ((amount is null) = (currency is null));

alter table public.stays
  add column price_amount numeric(12, 2),
  add column price_currency text;

alter table public.stays
  add constraint stays_price_amount_nonnegative check (price_amount is null or price_amount >= 0),
  add constraint stays_price_currency_code check (price_currency is null or char_length(price_currency) = 3),
  add constraint stays_price_amount_currency_pair check ((price_amount is null) = (price_currency is null));

alter table public.trip_expenses
  drop constraint if exists trip_expenses_currency_code;

alter table public.trip_expenses
  add constraint trip_expenses_currency_code check (char_length(currency) = 3);
