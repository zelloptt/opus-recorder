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
    if (index($_, "encoderWorker.wasm") != -1) {
        if (index($_, "var wasmBinaryFile = ") != -1) {
            printf RESULT ("var wasmBinaryFile = dataURIPrefix + '%s';\n", $base64);
        } elsif (index($_, "wasmBinaryFile = ") != -1) {
            printf RESULT ("wasmBinaryFile = dataURIPrefix + '%s';\n", $base64);
        } else {
            die "No pattern found! Check the content of " . $encoderFilePath . "!"
        }
    } else {
        print RESULT $_;
    }
}

unlink $base64FilePath;
