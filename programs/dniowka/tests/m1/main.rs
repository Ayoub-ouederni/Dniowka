//! M1 integration tests: the built program running in LiteSVM with an exactly-set clock.
//! Needs `target/deploy/dniowka.so` (`anchor test` builds it first).

// The helpers return LiteSVM's own `FailedTransactionMetadata` as the error, which is
// large by design (it carries the logs); boxing it would only obscure test code.
#![allow(clippy::result_large_err)]

mod guards;
mod harness;
mod spec;
