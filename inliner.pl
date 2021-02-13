#!/perl
my $wasmFilePath = 'dist-unminified/encoderWorker.wasm';
my $base64FilePath = './base64.txt';

my $encoderFilePath = './dist-unminified/encoderWorker.js';
my $inlineEncoderFilePath = './src/encoderWorker.inline.js';

`base64 $wasmFilePath > $base64FilePath`;
open(BASE64, $base64FilePath) or die "Error: no file found.";
(my $base64 = <BASE64>) =~ s/^\s+|\s+$//g;

open(SOURCE, $encoderFilePath);
open(RESULT, ">$inlineEncoderFilePath");
while (<SOURCE>) {
    if (/var wasmBinaryFile = 'encoderWorker.wasm';/) {
        printf RESULT ("var wasmBinaryFile = dataURIPrefix + '%s';\n", $base64);
    } else {
        print RESULT $_;
    }
}

unlink $base64FilePath;
