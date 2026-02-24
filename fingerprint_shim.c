/*
 * fingerprint_shim.c
 *
 * LD_PRELOAD shim that returns fixed values for the three inputs LicenseSpring
 * uses to build the machine fingerprint: machine-id (fixed in /etc/machine-id),
 * hostname, and MAC address.
 *
 * This makes the fingerprint identical on every container run regardless of
 * cloud platform (Render, AWS, local Docker) — no --hostname or --mac-address
 * flags required.
 *
 * Build:
 *   gcc -shared -fPIC -o fingerprint_shim.so fingerprint_shim.c -ldl
 */

#define _GNU_SOURCE
#include <dlfcn.h>
#include <string.h>
#include <stdarg.h>
#include <sys/ioctl.h>
#include <net/if.h>

/* Fixed hostname returned to any caller, including LicenseSpring */
#define FIXED_HOSTNAME "imfusion-server"

/* Fixed MAC: 02:42:ac:11:00:02 */
static const unsigned char FIXED_MAC[6] = {0x02, 0x42, 0xac, 0x11, 0x00, 0x02};

int gethostname(char *name, size_t len) {
    strncpy(name, FIXED_HOSTNAME, len);
    if (len > 0) name[len - 1] = '\0';
    return 0;
}

/*
 * Intercept ioctl: for SIOCGIFHWADDR (MAC address query) return the fixed MAC.
 * All other ioctl calls are forwarded to the real implementation.
 */
int ioctl(int fd, unsigned long request, ...) {
    static int (*real_ioctl)(int, unsigned long, ...) = NULL;
    if (!real_ioctl)
        real_ioctl = dlsym(RTLD_NEXT, "ioctl");

    va_list args;
    va_start(args, request);
    void *arg = va_arg(args, void *);
    va_end(args);

    int ret = real_ioctl(fd, request, arg);

    if (request == SIOCGIFHWADDR && ret == 0) {
        struct ifreq *ifr = (struct ifreq *)arg;
        memcpy(ifr->ifr_hwaddr.sa_data, FIXED_MAC, 6);
    }

    return ret;
}
